import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { commonHeaders, fail, HttpError, json, readJson, requireBrowserOrigin } from './http.mjs';
import { createSessions } from './sessions.mjs';
import { collectStyleHashes, inventory, serveStatic } from './static.mjs';
import { askTutor, tutorConfiguration, validatePrompt, PROMPT_VERSION } from './tutor.mjs';

function method(req,res,expected) {
  if (req.method !== expected) {res.setHeader('Allow',expected);throw new HttpError(405,'Method not allowed.');}
}
async function bind(server,port) {
  server.listen(port,'127.0.0.1');await once(server,'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
function stop(server) {
  return new Promise(resolve=>{server.closeAllConnections();server.close(()=>resolve());});
}
export async function createStudyServers({webRoot,runnerRoot,port=4318,runnerPort=4319,env=process.env,fetchImpl=fetch,logger=event=>console.info(JSON.stringify(event)),now=Date.now}) {
  const [studyFiles,runnerFiles]=await Promise.all([inventory(webRoot),inventory(runnerRoot)]);
  const styleHashes=await collectStyleHashes(studyFiles);
  const sessions=createSessions(now);
  let origin,runnerOrigin;
  const config=tutorConfiguration(env);
  async function studyApi(req,res,pathname) {
    requireBrowserOrigin(req,origin,pathname==='/api/v1/tutor');
    if(pathname==='/api/v1/session') {
      method(req,res,'GET');const session=sessions.open(req,res);
      return json(res,200,{csrfToken:session.csrf,aiConfigured:config.configured,model:config.configured?config.model:null,promptVersion:PROMPT_VERSION,apiVersion:'1'});
    }
    if(pathname!=='/api/v1/tutor') throw new HttpError(404,'Resource not found.');
    method(req,res,'POST');const session=sessions.authorize(req);
    const prompt=validatePrompt(await readJson(req));
    if(!config.configured) throw new HttpError(503,'AI tutoring is optional and not configured. Set your local TUTOR_ANTHROPIC_KEY and TUTOR_MODEL, then restart the study app.');
    sessions.charge(session,res);
    const correlationId=randomUUID();
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),30000);
    res.on('close',()=>controller.abort());
    try {
      const output=await askTutor(prompt,{env,fetchImpl,signal:controller.signal});
      logger({event:'tutor_complete',correlationId,model:config.model,promptVersion:PROMPT_VERSION,verdict:'transport_validated'});
      res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','X-API-Version':'1','X-Correlation-ID':correlationId});res.end(output);
    } finally {clearTimeout(timeout);}
  }
  function handler(runner) {
    return async (req,res)=>{
      commonHeaders(res);
      try {
        const ownOrigin=runner?runnerOrigin:origin;
        if(req.headers.host !== new URL(ownOrigin).host) throw new HttpError(403,'Use the exact local study app address printed by the launcher.');
        const pathname=req.url.split('?')[0];
        if(!runner&&pathname.startsWith('/api/')) await studyApi(req,res,pathname);
        else await serveStatic(req,res,{files:runner?runnerFiles:studyFiles,runner,studyOrigin:origin,runnerOrigin,styleHashes});
      } catch(error) {fail(res,error,logger);}
    };
  }
  const study=createServer({maxHeaderSize:16384},handler(false));
  const sandbox=createServer({maxHeaderSize:16384},handler(true));
  for(const server of [study,sandbox]) {server.requestTimeout=35000;server.headersTimeout=10000;server.maxRequestsPerSocket=100;}
  try {origin=await bind(study,port);runnerOrigin=await bind(sandbox,runnerPort);}
  catch(error) {await Promise.all([stop(study),stop(sandbox)]);throw error;}
  return {origin,runnerOrigin,close:()=>Promise.all([stop(study),stop(sandbox)])};
}
