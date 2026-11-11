import {
  WORKSPACE_KINDS, WORKSPACE_JURISDICTIONS, WORKSPACE_STATES,
  templatesFor,createWorkspace,validateWorkspace,updateStep,
  workspaceSummary,registryLinks
} from "./workspace-core.js";

const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=String(text);
  return node;
};
let workspace=createWorkspace("land","other");
const form=$("workspaceForm"), list=$("workspaceList");
const progress=$("workspaceProgress"),sources=$("workspaceSources");
const notice=$("workspaceNotice"),download=$("workspaceExport");
const sourceNote="These are external agency websites, not SafeKey integrations. Verify official agency requirements yourself. A link does not mean we checked your property.";
function alertNotice(text,success=false){
  notice.textContent=text;notice.classList.toggle("success",success);notice.hidden=!text;
}
function sourceLinks(){
  sources.replaceChildren();
  const found=registryLinks(workspace.jurisdiction);
  if(!found.length){
    sources.appendChild(el("p","muted","No specific official online directory is included for this state yet. Ask an independent lawyer to identify the relevant official land registry."));
  } else {
    for(const source of found){
      const box=el("div","source-card");
      const link=el("a","",source.label+" ↗");
      link.href=source.url;link.target="_blank";link.rel="noopener noreferrer";
      box.appendChild(link);box.appendChild(el("p","muted",source.purpose));
      sources.appendChild(box);
    }
  }
  sources.appendChild(el("p","muted",sourceNote));
}
function render(){
  const summary=workspaceSummary(workspace);
  progress.textContent=summary.started+" of "+summary.total+
    " checks have a buyer-recorded update. "+summary.independentReviewReported+
    " marked as independently reviewed by you. None are verified by SafeKey.";
  list.replaceChildren();
  const templates=templatesFor(workspace.kind);
  for(const step of templates){
    const current=workspace.steps.find(s=>s.id===step.id);
    const card=el("article","workspace-step");
    const head=el("div","workspace-step-head");
    head.appendChild(el("h3","",step.title));
    head.appendChild(el("span","workspace-owner",step.owner));
    const description=el("p","",step.detail);
    const suggested=el("p","muted","Request: "+step.evidence);
    const statusLabel=el("label","", "Your record of this check");
    const select=el("select","workspace-select");
    select.id="workspace-state-"+step.id;
    statusLabel.htmlFor=select.id;
    for(const [id,label] of WORKSPACE_STATES){
      const opt=el("option","",label);opt.value=id;select.appendChild(opt);
    }
    select.value=current.status;
    const noteLabel=el("label","", "Private note (optional, max 240 characters)");
    const note=el("textarea","workspace-note");
    note.id="workspace-note-"+step.id;
    noteLabel.htmlFor=note.id;
    note.rows=2;note.maxLength=240;note.value=current.note;
    note.placeholder="E.g. requested official search; date and who is responsible. Avoid personal secrets.";
    function save(){
      try{
        workspace=updateStep(workspace,step.id,select.value,note.value);
        const sum=workspaceSummary(workspace);
        progress.textContent=sum.started+" of "+sum.total+
          " checks have a buyer-recorded update. "+sum.independentReviewReported+
          " marked as independently reviewed by you. None are verified by SafeKey.";
      }catch(error){alertNotice(error.message)}
    }
    select.addEventListener("change",save);
    note.addEventListener("input",save);
    card.append(head,description,suggested,statusLabel,select,noteLabel,note);
    list.appendChild(card);
  }
  sourceLinks();
}
for(const [value,label] of WORKSPACE_JURISDICTIONS){
  const option=el("option","",label);option.value=value;
  $("workspaceJurisdiction").appendChild(option);
}
for(const kind of WORKSPACE_KINDS){
  const option=el("option","",kind==="land"?"Buying land":kind==="house"?"Buying a house":"Renting a home");
  option.value=kind;$("workspaceKind").appendChild(option);
}
form.addEventListener("submit",event=>{
  event.preventDefault();
  workspace=createWorkspace($("workspaceKind").value,$("workspaceJurisdiction").value);
  alertNotice("New workspace created in this tab. Remember to export before closing.",true);
  render();
});
download.addEventListener("click",()=>{
  try{
    const doc=validateWorkspace(workspace);
    const blob=new Blob([JSON.stringify(doc,null,2)+"\n"],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const link=el("a");
    link.href=url;link.download="safekey-checklist-"+doc.kind+"-"+new Date().toISOString().slice(0,10)+".json";
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    alertNotice("Private checklist exported. Protect the file: your notes may contain sensitive information.",true);
  }catch(error){alertNotice(error.message)}
});
$("workspaceImport").addEventListener("change",async event=>{
  const file=event.currentTarget.files?.[0];
  if(!file)return;
  if(file.size>65536||!file.name.toLowerCase().endsWith(".json")){
    alertNotice("Choose a SafeKey JSON checklist under 64 KB.");event.currentTarget.value="";return;
  }
  try {
    const data=JSON.parse(await file.text());
    const doc=validateWorkspace(data);
    workspace=doc;
    $("workspaceKind").value=doc.kind;$("workspaceJurisdiction").value=doc.jurisdiction;
    render();
    alertNotice("Checklist loaded into this tab only. No information was uploaded.",true);
  } catch {
    alertNotice("This is not a valid SafeKey checklist. No data was imported.");
  } finally {event.currentTarget.value="";}
});
$("workspaceReset").addEventListener("click",()=>{
  if(!window.confirm("Clear the checklist in this browser tab? Export it first if you want a copy."))return;
  workspace=createWorkspace($("workspaceKind").value,$("workspaceJurisdiction").value);
  render();alertNotice("Checklist cleared from this tab.",true);
});
render();
