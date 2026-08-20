import assert from "node:assert/strict";
import {readTextBounded} from "../src/bounded-response.js";

const small=new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"ok":'));controller.enqueue(new TextEncoder().encode('true}'));controller.close()}}));
assert.equal(await readTextBounded(small,32),'{"ok":true}');

const oversized=new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(8));controller.enqueue(new Uint8Array(8));controller.close()}}));
await assert.rejects(()=>readTextBounded(oversized,12),error=>error?.message==="UPSTREAM_RESPONSE_TOO_LARGE"&&error?.status===502);

const declared=new Response("too large",{headers:{"content-length":"100"}});
await assert.rejects(()=>readTextBounded(declared,8),error=>error?.message==="UPSTREAM_RESPONSE_TOO_LARGE"&&error?.status===502);

console.log(JSON.stringify({ok:true,suite:"bounded-response-contract",stream_limit_enforced:true}));
