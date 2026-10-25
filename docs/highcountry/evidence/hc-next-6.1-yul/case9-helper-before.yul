// Native Solc 0.8.24 optimized-Yul excerpt: first shuffle stage.
            function fun_readyFrozenAssignmentWithoutDelivery() -> var_id
            {
                /// @src 741:13950:13962  "id=_hand54()"
                var_id := /** @src 741:13953:13962  "_hand54()" */ fun_hand54()
                /// @src 744:1167:1182  "address(0x1234)"
                let _1 := sload(/** @src 741:14011:14015  "deal" */ 0x07)
                /// @src 744:1167:1182  "address(0x1234)"
                let cleaned := /** @src -1:-1:-1 */ 0
                /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                let _2 := sub(shl(160, 1), 1)
                let _3 := 64
                /// @src 741:14011:14027  "deal.getHand(id)"
                let _4 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ mload(_3)
                /// @src 741:14011:14027  "deal.getHand(id)"
                mstore(_4, /** @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))" */ shl(225, 0x408cf96f))
                /// @src 741:14011:14027  "deal.getHand(id)"
                let _5 := 4
                /// @src 745:1302:1329  "keccak256(\"poker table 52\")"
                mstore(/** @src 741:14011:14027  "deal.getHand(id)" */ add(_4, _5), /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ var_id)
                /// @src 741:14011:14027  "deal.getHand(id)"
                let _6 := 416
                /// @src 745:1302:1329  "keccak256(\"poker table 52\")"
                let _7 := 36
                /// @src 741:14011:14027  "deal.getHand(id)"
                let _8 := staticcall(gas(), /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ and(/** @src 745:1412:1428  "address(0xA11CE)" */ _1, /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ _2), /** @src 741:14011:14027  "deal.getHand(id)" */ _4, /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ _7, /** @src 741:14011:14027  "deal.getHand(id)" */ _4, _6)
                if iszero(_8)
                {
                    /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                    let pos := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ mload(_3)
                    /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                    returndatacopy(pos, /** @src -1:-1:-1 */ 0, /** @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))" */ returndatasize())
                    revert(pos, returndatasize())
                }
                /// @src 741:14011:14027  "deal.getHand(id)"
                if _8
                {
                    let _9 := _6
                    if gt(_6, returndatasize()) { _9 := returndatasize() }
                    finalize_allocation(_4, _9)
                    pop(abi_decode_struct_Hand_fromMemory(_4, add(_4, _9)))
                }
                /// @src 745:1412:1428  "address(0xA11CE)"
                let cleaned_1 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ and(sload(/** @src 741:14051:14062  "initialDeck" */ 0x0b), /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ _2)
                /// @src 741:14051:14073  "initialDeck.rootOf(id)"
                let _10 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ mload(_3)
                /// @src 741:14051:14073  "initialDeck.rootOf(id)"
                mstore(_10, /** @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))" */ shl(225, 0x36b79cc7))
                /// @src 745:1302:1329  "keccak256(\"poker table 52\")"
                mstore(/** @src 741:14051:14073  "initialDeck.rootOf(id)" */ add(_10, /** @src 741:14011:14027  "deal.getHand(id)" */ _5), /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ var_id)
                let _11 := 32
                /// @src 741:14051:14073  "initialDeck.rootOf(id)"
                let _12 := staticcall(gas(), cleaned_1, _10, /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ _7, /** @src 741:14051:14073  "initialDeck.rootOf(id)" */ _10, /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ _11)
                /// @src 741:14051:14073  "initialDeck.rootOf(id)"
                if iszero(_12)
                {
                    /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                    let pos_1 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ mload(_3)
                    /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                    returndatacopy(pos_1, /** @src -1:-1:-1 */ 0, /** @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))" */ returndatasize())
                    revert(pos_1, returndatasize())
                }
                /// @src 741:14051:14073  "initialDeck.rootOf(id)"
                let expr := /** @src -1:-1:-1 */ 0
                /// @src 741:14051:14073  "initialDeck.rootOf(id)"
                if _12
                {
                    let _13 := /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ _11
                    /// @src 741:14051:14073  "initialDeck.rootOf(id)"
                    if gt(/** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ _11, /** @src 741:14051:14073  "initialDeck.rootOf(id)" */ returndatasize()) { _13 := returndatasize() }
                    finalize_allocation(_10, _13)
                    /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                    if slt(sub(/** @src 741:14051:14073  "initialDeck.rootOf(id)" */ add(_10, _13), /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ _10), /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ _11)
                    /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                    {
                        revert(/** @src -1:-1:-1 */ 0, 0)
                    }
                    /// @src 741:14051:14073  "initialDeck.rootOf(id)"
                    expr := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ mload(_10)
                }
                /// @src 745:1412:1428  "address(0xA11CE)"
                let cleaned_2 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ and(sload(/** @src 741:14186:14194  "verifier" */ 0x08), /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ _2)
                /// @src 745:1412:1428  "address(0xA11CE)"
                let cleaned_3 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ and(sload(/** @src 741:14201:14205  "gate" */ 0x0c), /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ _2)
                /// @src 741:14201:14233  "gate.statement(id,1,input,first)"
                let _14 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ mload(_3)
                /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                let _15 := shl(224, 0xb8903e19)
                /// @src 741:14201:14233  "gate.statement(id,1,input,first)"
                mstore(_14, /** @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))" */ _15)
                /// @src 745:1302:1329  "keccak256(\"poker table 52\")"
                mstore(/** @src 741:14201:14233  "gate.statement(id,1,input,first)" */ add(_14, /** @src 741:14011:14027  "deal.getHand(id)" */ _5), /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ var_id)
                /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                mstore(add(/** @src 741:14201:14233  "gate.statement(id,1,input,first)" */ _14, /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ _7), /** @src 741:14219:14220  "1" */ 0x01)
                /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                let _16 := 68
                /// @src 745:1302:1329  "keccak256(\"poker table 52\")"
                mstore(/** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ add(/** @src 741:14201:14233  "gate.statement(id,1,input,first)" */ _14, /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ _16), /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ expr)
                /// @src 741:14097:14129  "keccak256(\"encrypted shuffle A\")"
                let _17 := 0x22b19d235d3db99683b7f4ca5c805a99859a3396d53de9c2a8deccf4318777bc
                /// @src 745:1302:1329  "keccak256(\"poker table 52\")"
                mstore(/** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ add(/** @src 741:14201:14233  "gate.statement(id,1,input,first)" */ _14, /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ 100), /** @src 741:14097:14129  "keccak256(\"encrypted shuffle A\")" */ _17)
                /// @src 741:14201:14233  "gate.statement(id,1,input,first)"
                let _18 := staticcall(gas(), cleaned_3, _14, /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ 132, /** @src 741:14201:14233  "gate.statement(id,1,input,first)" */ _14, /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ _11)
                /// @src 741:14201:14233  "gate.statement(id,1,input,first)"
                if iszero(_18)
                {
                    /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                    let pos_2 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ mload(_3)
                    /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                    returndatacopy(pos_2, /** @src -1:-1:-1 */ 0, /** @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))" */ returndatasize())
                    revert(pos_2, returndatasize())
                }
                /// @src 741:14201:14233  "gate.statement(id,1,input,first)"
                let expr_1 := /** @src -1:-1:-1 */ 0
                /// @src 741:14201:14233  "gate.statement(id,1,input,first)"
                if _18
                {
                    let _19 := /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ _11
                    /// @src 741:14201:14233  "gate.statement(id,1,input,first)"
                    if gt(/** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ _11, /** @src 741:14201:14233  "gate.statement(id,1,input,first)" */ returndatasize()) { _19 := returndatasize() }
                    finalize_allocation(_14, _19)
                    /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                    if slt(sub(/** @src 741:14201:14233  "gate.statement(id,1,input,first)" */ add(_14, _19), /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ _14), /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ _11)
                    /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                    {
                        revert(/** @src -1:-1:-1 */ 0, 0)
                    }
                    /// @src 741:14201:14233  "gate.statement(id,1,input,first)"
                    expr_1 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ mload(_14)
                }
                /// @src 741:14186:14234  "verifier.allow(gate.statement(id,1,input,first))"
                if iszero(extcodesize(cleaned_2))
                {
                    /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                    revert(/** @src -1:-1:-1 */ 0, 0)
                }
                /// @src 741:14186:14234  "verifier.allow(gate.statement(id,1,input,first))"
                let _20 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ mload(_3)
                /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                let _21 := shl(224, 0xe8ffb32f)
                /// @src 741:14186:14234  "verifier.allow(gate.statement(id,1,input,first))"
                mstore(_20, /** @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))" */ _21)
                /// @src 745:1302:1329  "keccak256(\"poker table 52\")"
                mstore(/** @src 741:14186:14234  "verifier.allow(gate.statement(id,1,input,first))" */ add(_20, /** @src 741:14011:14027  "deal.getHand(id)" */ _5), /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ expr_1)
                /// @src 741:14186:14234  "verifier.allow(gate.statement(id,1,input,first))"
                let _22 := call(gas(), cleaned_2, /** @src -1:-1:-1 */ 0, /** @src 741:14186:14234  "verifier.allow(gate.statement(id,1,input,first))" */ _20, /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ _7, /** @src 741:14186:14234  "verifier.allow(gate.statement(id,1,input,first))" */ _20, /** @src -1:-1:-1 */ 0)
                /// @src 741:14186:14234  "verifier.allow(gate.statement(id,1,input,first))"
                if iszero(_22)
                {
                    /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                    let pos_3 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ mload(_3)
                    /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                    returndatacopy(pos_3, /** @src -1:-1:-1 */ 0, /** @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))" */ returndatasize())
                    revert(pos_3, returndatasize())
                }
                /// @src 741:14186:14234  "verifier.allow(gate.statement(id,1,input,first))"
                if _22
                {
                    finalize_allocation_104655(_20)
                    /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                    cleaned := /** @src -1:-1:-1 */ 0
                }
                /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                let _23 := 0x7109709ecfa91a80626ff3989d68f67f5b1dd12d
                /// @src 741:14244:14269  "cheat54.prank(PROVIDER_A)"
                if iszero(extcodesize(/** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ _23))
                /// @src 741:14244:14269  "cheat54.prank(PROVIDER_A)"
                {
                    /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                    revert(/** @src -1:-1:-1 */ cleaned, cleaned)
                }
                /// @src 741:14244:14269  "cheat54.prank(PROVIDER_A)"
                let _24 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ mload(_3)
                /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                let _25 := shl(224, 0xca669fa7)
                /// @src 741:14244:14269  "cheat54.prank(PROVIDER_A)"
                mstore(_24, /** @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))" */ _25)
                /// @src 745:1412:1428  "address(0xA11CE)"
                mstore(/** @src 741:14244:14269  "cheat54.prank(PROVIDER_A)" */ add(_24, /** @src 741:14011:14027  "deal.getHand(id)" */ _5), /** @src 736:486:492  "0xAA54" */ 0xaa54)
                /// @src 741:14244:14269  "cheat54.prank(PROVIDER_A)"
                let _26 := call(gas(), /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ _23, /** @src -1:-1:-1 */ cleaned, /** @src 741:14244:14269  "cheat54.prank(PROVIDER_A)" */ _24, /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ _7, /** @src 741:14244:14269  "cheat54.prank(PROVIDER_A)" */ _24, /** @src -1:-1:-1 */ cleaned)
                /// @src 741:14244:14269  "cheat54.prank(PROVIDER_A)"
                if iszero(_26)
                {
                    /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                    let pos_4 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ mload(_3)
                    /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                    returndatacopy(pos_4, /** @src -1:-1:-1 */ cleaned, /** @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))" */ returndatasize())
                    revert(pos_4, returndatasize())
                }
                /// @src 741:14244:14269  "cheat54.prank(PROVIDER_A)"
                if _26
                {
                    finalize_allocation_104655(_24)
                    /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                    if cleaned
                    {
                        revert(/** @src -1:-1:-1 */ cleaned, cleaned)
                    }
                }
                /// @src 745:1412:1428  "address(0xA11CE)"
                let cleaned_4 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ and(sload(/** @src 741:14201:14205  "gate" */ 0x0c), /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ _2)
                /// @src 741:14270:14315  "gate.proveStage(id,1,input,first,hex\"010203\")"
                if iszero(extcodesize(cleaned_4))
                {
                    /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                    revert(/** @src -1:-1:-1 */ cleaned, cleaned)
                }
                /// @src 741:14270:14315  "gate.proveStage(id,1,input,first,hex\"010203\")"
                let _27 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ mload(_3)
                /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                let _28 := shl(224, 0x57024761)
                /// @src 741:14270:14315  "gate.proveStage(id,1,input,first,hex\"010203\")"
                mstore(_27, /** @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))" */ _28)
                /// @src 745:1302:1329  "keccak256(\"poker table 52\")"
                mstore(/** @src 741:14270:14315  "gate.proveStage(id,1,input,first,hex\"010203\")" */ add(_27, /** @src 741:14011:14027  "deal.getHand(id)" */ _5), /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ var_id)
                /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                mstore(/** @src 736:478:493  "address(0xAA54)" */ add(/** @src 741:14270:14315  "gate.proveStage(id,1,input,first,hex\"010203\")" */ _27, /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ _7), /** @src 741:14219:14220  "1" */ 0x01)
                /// @src 745:1302:1329  "keccak256(\"poker table 52\")"
                mstore(/** @src 736:478:493  "address(0xAA54)" */ add(/** @src 741:14270:14315  "gate.proveStage(id,1,input,first,hex\"010203\")" */ _27, /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ _16), /** @src 745:1302:1329  "keccak256(\"poker table 52\")" */ expr)
                mstore(/** @src 736:478:493  "address(0xAA54)" */ add(/** @src 741:14270:14315  "gate.proveStage(id,1,input,first,hex\"010203\")" */ _27, /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ 100), /** @src 741:14097:14129  "keccak256(\"encrypted shuffle A\")" */ _17)
                /// @src 736:478:493  "address(0xAA54)"
                mstore(add(/** @src 741:14270:14315  "gate.proveStage(id,1,input,first,hex\"010203\")" */ _27, /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ 132), /** @src 736:478:493  "address(0xAA54)" */ 160)
                /// @src 741:14270:14315  "gate.proveStage(id,1,input,first,hex\"010203\")"
                let _29 := call(gas(), cleaned_4, /** @src -1:-1:-1 */ cleaned, /** @src 741:14270:14315  "gate.proveStage(id,1,input,first,hex\"010203\")" */ _27, sub(/** @src 736:478:493  "address(0xAA54)" */ abi_encode_stringliteral_f188(add(/** @src 741:14270:14315  "gate.proveStage(id,1,input,first,hex\"010203\")" */ _27, /** @src 736:478:493  "address(0xAA54)" */ 164)), /** @src 741:14270:14315  "gate.proveStage(id,1,input,first,hex\"010203\")" */ _27), _27, /** @src -1:-1:-1 */ cleaned)
                /// @src 741:14270:14315  "gate.proveStage(id,1,input,first,hex\"010203\")"
                if iszero(_29)
                {
                    /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                    let pos_5 := /** @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..." */ mload(_3)
                    /// @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))"
                    returndatacopy(pos_5, /** @src -1:-1:-1 */ cleaned, /** @src 745:1205:1271  "VmTable52(address(uint160(uint256(keccak256(\"hevm cheat code\")))))" */ returndatasize())
                    revert(pos_5, returndatasize())
                }
                /// @src 741:14270:14315  "gate.proveStage(id,1,input,first,hex\"010203\")"
                if _29
                {
                    finalize_allocation_104655(_27)
                    /// @src 741:32015:38727  "contract PokerNLHEBetting54Case9Test is PokerNLHEBetting54Fixture {..."
                    if cleaned
                    {
                        revert(/** @src -1:-1:-1 */ cleaned, cleaned)
                    }
                }
                /// @src 745:1412:1428  "address(0xA11CE)"

// Excerpt ends before the second shuffle stage.
