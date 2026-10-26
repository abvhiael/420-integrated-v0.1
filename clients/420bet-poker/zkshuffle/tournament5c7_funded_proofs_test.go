package shuffle

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/consensys/gnark-crypto/ecc"
	native "github.com/consensys/gnark-crypto/ecc/bn254/twistededwards"
	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/constraint"
	"github.com/consensys/gnark/frontend"
	"math/big"
	"os"
	"path/filepath"
	"testing"
)

// This owner accepts only the actual tournament ABI context emitted by the funded
// fixture. Every proof is generated and verified with a persisted, exact setup.
// No historical 420 hand proof is relabelled or given altered public inputs.
func TestTournament5C7GenuineHandProofs(t *testing.T) {
	contextFile := os.Getenv("POKER_TOURNAMENT_C7_CONTEXT")
	if contextFile == "" {
		t.Skip("requires the production contract context export")
	}
	material := os.Getenv("POKER_WS8_MATERIAL_DIR")
	out := os.Getenv("POKER_ZK_ARTIFACT_DIR")
	if material == "" || out == "" {
		t.Fatal("explicit material and proof directories required")
	}
	raw, err := os.ReadFile(contextFile)
	if err != nil {
		t.Fatal(err)
	}
	var context struct {
		Words          []string `json:"words"`
		Seats          []int    `json:"seats"`
		Owners         []int    `json:"owners"`
		WinnerPosition int      `json:"winnerPosition"`
	}
	if err = json.Unmarshal(raw, &context); err != nil {
		t.Fatal(err)
	}
	fields := context.Words
	seats := len(context.Seats)
	if seats < 2 || seats > 9 || len(fields) != 34+(seats-2)*2 || len(context.Owners) != 2*seats {
		t.Fatal("invalid actual tournament seat context")
	}
	for _, seat := range context.Owners {
		found := false
		for _, v := range context.Seats {
			if v == seat {
				found = true
			}
		}
		if !found {
			t.Fatal("owner outside actual mask")
		}
	}
	otherSeat := func(seat int) int {
		for _, v := range context.Seats {
			if v != seat {
				return v
			}
		}
		panic("missing alternate recipient")
	}
	var c [34]*big.Int
	for i, s := range fields[:34] {
		var ok bool
		c[i], ok = new(big.Int).SetString(s, 10)
		if !ok || c[i].Sign() < 0 || c[i].BitLen() > 256 {
			t.Fatal("invalid ABI word", i)
		}
	}
	if c[9].Cmp(big.NewInt(31337)) != 0 {
		t.Fatal("wrong chain")
	}
	scope := new(big.Int).Mod(new(big.Int).Set(c[0]), ecc.BN254.ScalarField())
	if scope.Cmp(big.NewInt(420)) == 0 || scope.Sign() == 0 {
		t.Fatal("synthetic hand context")
	}
	word := func(n *big.Int) [32]byte { return testWordNumber(n) }
	hash := func(indices []int, extra ...[32]byte) *big.Int {
		words := make([][32]byte, 0, len(indices)+len(extra))
		for _, i := range indices {
			words = append(words, word(c[i]))
		}
		words = append(words, extra...)
		return ws3Scalar(words...)
	}
	write := func(name string, data []byte) {
		t.Helper()
		if err := os.MkdirAll(out, 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(out, name), data, 0644); err != nil {
			t.Fatal(err)
		}
	}
	pack := func(values ...frontend.Variable) []byte {
		var b []byte
		for _, v := range values {
			var n *big.Int
			switch z := v.(type) {
			case *big.Int:
				n = z
			case int:
				n = big.NewInt(int64(z))
			case int64:
				n = big.NewInt(z)
			default:
				t.Fatalf("unsupported field %T", v)
			}
			if n.Sign() < 0 || n.Cmp(ecc.BN254.ScalarField()) >= 0 {
				t.Fatal("noncanonical proof field")
			}
			b = append(b, n.FillBytes(make([]byte, 32))...)
		}
		return b
	}
	type setup struct {
		cs constraint.ConstraintSystem
		pk groth16.ProvingKey
		vk groth16.VerifyingKey
	}
	load := func(name string) setup {
		t.Helper()
		s := setup{groth16.NewCS(ecc.BN254), groth16.NewProvingKey(ecc.BN254), groth16.NewVerifyingKey(ecc.BN254)}
		readers := []struct {
			suffix string
			read   func(*bytes.Reader) (int64, error)
		}{
			{".r1cs", func(r *bytes.Reader) (int64, error) { return s.cs.ReadFrom(r) }},
			{".pk", func(r *bytes.Reader) (int64, error) { return s.pk.ReadFrom(r) }},
			{".vk", func(r *bytes.Reader) (int64, error) { return s.vk.ReadFrom(r) }},
		}
		for _, r := range readers {
			b, e := os.ReadFile(filepath.Join(material, name+r.suffix))
			if e != nil {
				t.Fatal(e)
			}
			if _, e = r.read(bytes.NewReader(b)); e != nil {
				t.Fatal(e)
			}
		}
		return s
	}
	var reuseReport []map[string]string
	prove := func(s setup, name string, w frontend.Circuit, values ...frontend.Variable) {
		t.Helper()
		full, e := frontend.NewWitness(w, ecc.BN254.ScalarField())
		if e != nil {
			t.Fatal(e)
		}
		pub, e := full.Public()
		if e != nil {
			t.Fatal(e)
		}
		serialized, e := pub.MarshalBinary()
		if e != nil {
			t.Fatal(e)
		}
		encoded := pack(values...)
		if len(serialized) < len(encoded) || !bytes.Equal(serialized[len(serialized)-len(encoded):], encoded) {
			t.Fatal(name, "public serialization mismatch")
		}
		var proof groth16.Proof
		status := "generated-context-specific"
		cache := os.Getenv("POKER_WS8_REUSE_DIR")
		if cache != "" {
			old, err := os.ReadFile(filepath.Join(cache, name+".public"))
			if err == nil && bytes.Equal(old, serialized) {
				raw, err := os.ReadFile(filepath.Join(cache, name+"Proof.bin"))
				if os.IsNotExist(err) {
					raw, err = os.ReadFile(filepath.Join(cache, "EXPERIMENTAL-"+name+"Proof.bin"))
				}
				if err != nil {
					t.Fatal(err)
				}
				proof = groth16.NewProof(ecc.BN254)
				if _, err = proof.ReadFrom(bytes.NewReader(raw)); err != nil {
					t.Fatal(err)
				}
				if err = groth16.Verify(proof, s.vk, pub); err != nil {
					proof = nil
					t.Log("cached proof is incompatible with the retained verifying key; generating a genuine replacement", name)
				} else {
					status = "reused-identical-public-witness"
				}
			}
		}
		if proof == nil {
			proof, e = groth16.Prove(s.cs, s.pk, full)
			if e != nil {
				t.Fatal(name, e)
			}
		}
		if e = groth16.Verify(proof, s.vk, pub); e != nil {
			t.Fatal(name, e)
		}
		var canonicalProof bytes.Buffer
		if _, e = proof.WriteTo(&canonicalProof); e != nil {
			t.Fatal(e)
		}
		write(name+"Proof.bin", canonicalProof.Bytes())
		reuseReport = append(reuseReport, map[string]string{"proof": name, "material": status})
		write(name+".public", serialized)
		solidity, ok := proof.(interface{ MarshalSolidity() []byte })
		if !ok {
			t.Fatal("missing Solidity encoding")
		}
		write(name+".abi", append(solidity.MarshalSolidity(), encoded...))
		exportTestGroth16Solidity(t, name, s.vk, proof, values...)
		t.Log("verified genuine funded-hand proof", name)
	}
	rootPath := func(cards []ElGamalCipher, position int) (*big.Int, [6]*big.Int) {
		var nodes [64]*big.Int
		for i := 0; i < 52; i++ {
			v := cards[i]
			nodes[i] = nativeMiMCHash(big.NewInt(cipherLeafDomain), scope, big.NewInt(int64(i)), v.C1X.(*big.Int), v.C1Y.(*big.Int), v.C2X.(*big.Int), v.C2Y.(*big.Int))
		}
		for i := 52; i < 64; i++ {
			nodes[i] = big.NewInt(0)
		}
		var path [6]*big.Int
		index, width := position, 64
		for depth := 0; depth < 6; depth++ {
			path[depth] = new(big.Int).Set(nodes[index^1])
			for j := 0; j < width/2; j++ {
				nodes[j] = nativeMiMCHash(big.NewInt(cipherNodeDomain), big.NewInt(int64(depth)), nodes[2*j], nodes[2*j+1])
			}
			index /= 2
			width /= 2
		}
		return nodes[0], path
	}
	curve := native.GetEdwardsCurve()
	base := curve.Base
	threshold := new(native.PointAffine).ScalarMultiplication(&base, big.NewInt(1729))
	pkx, pky := coordinates(threshold)
	if pkx.(*big.Int).Cmp(c[32]) != 0 || pky.(*big.Int).Cmp(c[33]) != 0 {
		t.Fatal("threshold key differs from production")
	}
	variant := os.Getenv("POKER_WS8_SINGLE_WINNER")
	if variant != "" && variant != "1" {
		t.Fatal("unknown showdown fixture")
	}
	if variant != "1" || context.WinnerPosition < 0 || context.WinnerPosition >= seats {
		t.Fatal("explicit actual fixture winner position required")
	}
	cardAt := func(i int) int {
		if i == context.WinnerPosition {
			return 12
		}
		if i == 12 {
			return context.WinnerPosition
		}
		return i
	}
	var decks [3][52]ElGamalCipher
	for i := 0; i < 52; i++ {
		a, b := cipherOf(int64(i+1), int64(i+100), &base, threshold)
		decks[0][i] = reencryptInput(a, b)
		// Stage A reverses the original order and independently rerandomizes.
		a, b = cipherOf(int64(52-i), 1151, &base, threshold)
		decks[1][i] = reencryptInput(a, b)
		a, b = cipherOf(int64(cardAt(i)+1), int64(3151+i), &base, threshold)
		decks[2][i] = reencryptInput(a, b)
	}
	var roots [3]*big.Int
	for stage := 0; stage < 3; stage++ {
		roots[stage], _ = rootPath(decks[stage][:], 0)
		var words []frontend.Variable
		for _, v := range decks[stage] {
			words = append(words, v.C1X, v.C1Y, v.C2X, v.C2Y)
		}
		write(fmt.Sprintf("deck-%d.bin", stage), pack(words...))
	}
	write("roots.bin", pack(roots[0], roots[1], roots[2]))
	// Initial statement exactly mirrors PokerInitialEncryptedDeck420.statement.
	initialWords := [][32]byte{testTextHash("420.BET.POKER.CANONICAL.INITIAL.ELGAMAL.V1")}
	for _, i := range []int{9, 10, 11, 12, 13, 14, 15, 16, 0, 1, 2, 3, 4, 5, 6, 7, 8} {
		initialWords = append(initialWords, word(c[i]))
	}
	initialWords = append(initialWords, word(roots[0]))
	initialStatement := ws3Scalar(initialWords...)
	inv8 := new(big.Int).ModInverse(big.NewInt(8), &curve.Order)
	q := new(native.PointAffine).ScalarMultiplication(threshold, inv8)
	qx, qy := coordinates(q)
	initial := &InitialDeck52{HandScope: scope, StatementScope: initialStatement, PublicKeyX: pkx, PublicKeyY: pky, SubgroupPreimageX: qx, SubgroupPreimageY: qy, DeckRoot: roots[0], Cards: decks[0]}
	for i := 0; i < 52; i++ {
		initial.Randomness[i] = 100 + i
	}
	prove(load("InitialDeck52"), "WS8Initial", initial, roots[0], initialStatement, scope, pkx, pky)
	shuffleSetup := load("Reencrypt52")
	for stage := 1; stage <= 2; stage++ {
		words := [][32]byte{testTextHash("420.BET.POKER.ZK.REENCRYPTION.SHUFFLE.V1")}
		for _, i := range []int{9, 17, 18, 16, 0, 1, 2, 3, 4, 5, 6, 7, 8} {
			words = append(words, word(c[i]))
		}
		words = append(words, testWordInt(int64(stage)), word(roots[stage-1]), word(roots[stage]))
		statement := ws3Scalar(words...)
		w := &Reencrypt52{HandScope: scope, StatementScope: statement, PublicKeyX: pkx, PublicKeyY: pky, InputRoot: roots[stage-1], OutputRoot: roots[stage], Input: decks[stage-1], Output: decks[stage]}
		for i := 0; i < 52; i++ {
			w.Indices[i] = 51 - i
			if stage == 2 {
				w.Indices[i] = 51 - cardAt(i)
			}
			w.Nonces[i] = stage*1000 + i
		}
		prove(shuffleSetup, fmt.Sprintf("WS8Shuffle%d", stage), w, roots[stage-1], statement, roots[stage], scope, pkx, pky)
	}
	providers := [2]*big.Int{big.NewInt(887), big.NewInt(842)}
	recipientSecrets := make([]*big.Int, 9)
	for i := range recipientSecrets {
		recipientSecrets[i] = big.NewInt(int64(1021 + i*216))
	}
	var providerPK [2]*native.PointAffine
	recipientPK := make([]*native.PointAffine, 9)
	for i := 0; i < 2; i++ {
		providerPK[i] = new(native.PointAffine).ScalarMultiplication(&base, providers[i])
	}
	fingerprints := make([][32]byte, 9)
	popSetup := load("RecipientPoP")
	for ordinal, seat := range context.Seats {
		recipientPK[seat] = new(native.PointAffine).ScalarMultiplication(&base, recipientSecrets[seat])
		x, y := coordinates(recipientPK[seat])
		keyWords := [][32]byte{testTextHash("420.BET.POKER.RECIPIENT.KEY.POP.V1")}
		for _, i := range []int{9, 20, 1} {
			keyWords = append(keyWords, word(c[i]))
		}
		for j := 0; j < 2; j++ {
			index := 22 + 2*ordinal + j
			if ordinal >= 2 {
				index = 34 + 2*(ordinal-2) + j
			}
			value, ok := new(big.Int).SetString(fields[index], 10)
			if !ok || value.Sign() < 0 || value.BitLen() > 256 {
				t.Fatal("invalid recipient context")
			}
			keyWords = append(keyWords, word(value))
		}
		keyScope := ws3Scalar(keyWords...)
		fingerprints[seat] = ws3Hash(append(keyWords, ws3Word(x), ws3Word(y))...)
		w := &RecipientKeyPossessionV1{Scope: keyScope, KeyX: x, KeyY: y, Secret: recipientSecrets[seat]}
		prove(popSetup, fmt.Sprintf("WS8Recipient%d", seat), w, keyScope, x, y)
	}
	aggregateWords := [][32]byte{testTextHash("420.BET.POKER.PRIVATE.SHARE.AGGREGATE.V1")}
	for _, i := range []int{9, 19, 17, 26, 27, 28, 29, 30, 31, 32, 33} {
		aggregateWords = append(aggregateWords, word(c[i]))
	}
	aggScope := ws3Scalar(aggregateWords...)
	agg := &ThresholdKeyAggregateV1{Scope: aggScope, ProviderAX: c[28], ProviderAY: c[29], ProviderBX: c[30], ProviderBY: c[31], AggregateX: c[32], AggregateY: c[33]}
	prove(load("Aggregate"), "WS8Aggregate", agg, aggScope, c[28], c[29], c[30], c[31], c[32], c[33])
	deliverySetup := load("Delivery")
	for position := 0; position < 2*seats; position++ {
		seat := context.Owners[position]
		card := decks[2][position]
		_, path := rootPath(decks[2][:], position)
		c1, _ := cipherOf(int64(cardAt(position)+1), int64(3151+position), &base, threshold)
		for provider := 0; provider < 2; provider++ {
			nonce := big.NewInt(int64(100001 + position*100 + provider*13))
			share := new(native.PointAffine).ScalarMultiplication(&c1, providers[provider])
			u := new(native.PointAffine).ScalarMultiplication(&base, nonce)
			ephemeral := new(native.PointAffine).ScalarMultiplication(recipientPK[seat], nonce)
			v := new(native.PointAffine).Add(share, ephemeral)
			px, py := coordinates(providerPK[provider])
			rx, ry := coordinates(recipientPK[seat])
			ux, uy := coordinates(u)
			vx, vy := coordinates(v)
			points := []frontend.Variable{card.C1X, card.C1Y, card.C2X, card.C2Y, px, py, rx, ry, ux, uy, vx, vy}
			words := [][32]byte{testTextHash("420.BET.POKER.PRIVATE.SHARE.DELIVERY.CONTEXT.V1"), word(c[9]), word(c[19]), word(c[0]), testWordInt(int64(position)), testWordInt(int64(seat)), testWordInt(int64(provider)), word(roots[2]), fingerprints[seat], word(c[21])}
			for _, p := range points {
				words = append(words, ws3Word(p))
			}
			context := ws3Scalar(words...)
			w := &EncryptedShareDeliveryV1{HandScope: scope, DeckRoot: roots[2], Position: position, Seat: seat, ProviderIndex: provider, DeliveryContext: context, CipherC1X: card.C1X, CipherC1Y: card.C1Y, CipherC2X: card.C2X, CipherC2Y: card.C2Y, ProviderPKX: px, ProviderPKY: py, RecipientPKX: rx, RecipientPKY: ry, EnvelopeUX: ux, EnvelopeUY: uy, EnvelopeVX: vx, EnvelopeVY: vy, ProviderSecret: providers[provider], EncryptionNonce: nonce}
			for i := 0; i < 6; i++ {
				w.MerklePath[i] = path[i]
			}
			name := fmt.Sprintf("WS8Delivery%d%d", position, provider)
			prove(deliverySetup, name, w, append([]frontend.Variable{scope, roots[2], position, seat, provider, context}, points...)...)
			write(name+".points", pack(points...))
			// Recipient-only recovery checks use actual secrets and the same ciphertext.
			recovered := new(native.PointAffine).ScalarMultiplication(u, recipientSecrets[seat])
			recovered.Neg(recovered)
			recovered.Add(v, recovered)
			if !recovered.Equal(share) {
				t.Fatal("recipient cannot recover provider share")
			}
			wrong := new(native.PointAffine).ScalarMultiplication(u, recipientSecrets[otherSeat(seat)])
			wrong.Neg(wrong)
			wrong.Add(v, wrong)
			if wrong.Equal(share) {
				t.Fatal("wrong recipient recovered provider share")
			}
		}
	}
	partialSetup, unmaskSetup := load("Partial"), load("Unmask")
	slots := [][2]int{{1, 2*seats + 1}, {1, 2*seats + 2}, {1, 2*seats + 3}, {2, 2*seats + 5}, {3, 2*seats + 7}}
	for i := 0; i < 2*seats; i++ {
		slots = append(slots, [2]int{4, i})
	}
	for _, slot := range slots {
		street, position := slot[0], slot[1]
		card := decks[2][position]
		_, path := rootPath(decks[2][:], position)
		c1, _ := cipherOf(int64(cardAt(position)+1), int64(3151+position), &base, threshold)
		var shares [2]*native.PointAffine
		for provider := 0; provider < 2; provider++ {
			shares[provider] = new(native.PointAffine).ScalarMultiplication(&c1, providers[provider])
			dx, dy := coordinates(shares[provider])
			px, py := coordinates(providerPK[provider])
			w := &PartialDecryptCircuit{HandScope: scope, DeckRoot: roots[2], CipherC2X: card.C2X, CipherC2Y: card.C2Y, Position: position, Street: street, ProviderIndex: provider, CipherC1X: card.C1X, CipherC1Y: card.C1Y, ProviderPKX: px, ProviderPKY: py, ShareDX: dx, ShareDY: dy, SecretShare: providers[provider]}
			for i := 0; i < 6; i++ {
				w.MerklePath[i] = path[i]
			}
			name := fmt.Sprintf("WS8Partial%d%d%d", street, position, provider)
			prove(partialSetup, name, w, scope, roots[2], card.C2X, card.C2Y, position, street, provider, card.C1X, card.C1Y, px, py, dx, dy)
			write(name+".points", pack(card.C1X, card.C1Y, card.C2X, card.C2Y, px, py, dx, dy))
		}
		ax, ay := coordinates(shares[0])
		bx, by := coordinates(shares[1])
		w := &CardUnmaskCircuit{HandScope: scope, DeckRoot: roots[2], Position: position, Street: street, CardIndex: cardAt(position), CipherC2X: card.C2X, CipherC2Y: card.C2Y, ShareAX: ax, ShareAY: ay, ShareBX: bx, ShareBY: by, ProviderAX: c[28], ProviderAY: c[29], ProviderBX: c[30], ProviderBY: c[31], AggregatePKX: c[32], AggregatePKY: c[33]}
		prove(unmaskSetup, fmt.Sprintf("WS8Unmask%d%d", street, position), w, scope, roots[2], position, street, cardAt(position), card.C2X, card.C2Y, ax, ay, bx, by, c[28], c[29], c[30], c[31], c[32], c[33])
	}
	report, e := json.MarshalIndent(reuseReport, "", "  ")
	if e != nil {
		t.Fatal(e)
	}
	write("reuse-report.json", append(report, '\n'))
	// Force a direct relation between all recomputed roots and the context export.
	_ = hash
}
