/** Native UI/IPC still run normally; only OpenAI endpoints use deterministic, non-billable fixtures. */
export async function installAgentNetworkFixture(desktop){
 await desktop.evaluate(({net})=>{
  const original=net.fetch.bind(net);
  net.fetch=(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   return /^https:\/\/(api|developers)\.openai\.com\//.test(url)?globalThis.fetch(input,init):original(input,init);
  };
 });
}
