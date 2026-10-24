import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {test} from "node:test";
const root=new URL("../../../",import.meta.url);
const data=JSON.parse(readFileSync(new URL("assets/budtender/characters/art_direction.json",root),"utf8"));
test("BUD-CHAR-01.1 draft contract preserves boundaries",()=>{
 assert.equal(data.schema_version,1);assert.equal(data.step,"BUD-CHAR-01.1");
 assert.equal(data.status,"draft-awaiting-visual-approval");
 assert.deepEqual(data.scene_layers,{customer:"09_CUSTOMERS",staff:"10_STAFF"});
 assert.deepEqual(data.required_directions,["front","left","right"]);
 assert.equal(new Set(data.expressions).size,5);assert.equal(data.outfits_per_archetype,2);
 assert.ok(data.canvas.width>0&&data.canvas.height>0&&data.canvas.channels==="RGBA");
 assert.ok(data.canvas.baseline_anchor.x<data.canvas.width&&data.canvas.baseline_anchor.y<data.canvas.height);
 assert.ok(Object.values(data.approval).every(v=>v===false),"visual approval must not be fabricated");
});
