export async function withBoundedRetry420(operation,{
  maxAttempts=3, baseDelayMs=25, deadlineMs=Date.now()+30_000,
  sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms)),
  shouldRetry=(error)=>error?.transient===true,
  now=()=>Date.now()
}={}) {
  if (!Number.isInteger(maxAttempts)||maxAttempts<1) throw new TypeError("maxAttempts invalid");
  let last;
  for (let attempt=1; attempt<=maxAttempts; attempt+=1) {
    if (now()>deadlineMs) throw Object.assign(new Error("retry deadline exceeded"),{cause:last});
    try { return await operation({attempt}); }
    catch (error) {
      last=error;
      if (!shouldRetry(error)||attempt===maxAttempts) throw error;
      await sleep(baseDelayMs*Math.min(2**(attempt-1),16));
    }
  }
  throw last;
}
