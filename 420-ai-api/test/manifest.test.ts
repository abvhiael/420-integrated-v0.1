import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAIServiceDescriptor420 } from '../src/index.js';

const descriptor={
  schema:'420-ai-service-v1' as const,
  apiVersion:'v1' as const,
  baseUrl:'https://ai-api.example',
  chainId:'420',
  protocolRegistry:'0x0000000000000000000000000000000000000434',
  capabilities:['providers','models','jobs','job-events'] as const,
  authoritative:false as const
};

test('AI service descriptor validates qualified HTTPS endpoint',()=>{
  assert.equal(validateAIServiceDescriptor420(descriptor).authoritative,false);
});

test('AI service descriptor rejects insecure remote endpoints and authority claims',()=>{
  assert.throws(()=>validateAIServiceDescriptor420({...descriptor,baseUrl:'http://ai-api.example'}),/HTTPS/);
  assert.throws(()=>validateAIServiceDescriptor420({...descriptor,authoritative:true as false}),/authoritative=false/);
});
