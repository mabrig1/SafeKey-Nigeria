/**
 * Local-only evidence manifest. Files NEVER leave the browser:
 * only SHA-256 fingerprints and user-entered metadata enter an optional
 * manually downloaded JSON file. Hashes prove byte-level consistency only,
 * never ownership, authenticity, identity or truth of an allegation.
 */
(() => {
  const select = id => document.getElementById(id);
  const button = select("evidenceAdd"), fileField=select("evidenceFile"),
    noteField=select("evidenceNote"), sourceField=select("evidenceSource"),
    info=select("evidenceNotice"), list=select("evidenceList"),
    exportButton=select("evidenceExport"), clearButton=select("evidenceClear");
  let records=[];
  const MAX_SIZE=15*1024*1024, MAX_RECORDS=12;
  const element=(tag,cls,text)=>{
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(text!==undefined)e.textContent=String(text);
    return e;
  };
  function message(text,isError=false){
    info.hidden=false;info.textContent=text;
    info.classList.toggle("success",!isError);
  }
  function render(){
    list.replaceChildren();
    if(!records.length){
      list.appendChild(element("p","muted","No files hashed yet. Nothing is uploaded or saved automatically."));
    }
    records.forEach((r,index)=>{
      const card=element("div","evidence-entry");
      const title=element("strong","",r.name);
      const small=element("p","muted",r.kind+" · "+r.sizeBytes.toLocaleString()+" bytes · "+r.hashedAt);
      const hash=element("code","evidence-digest",r.sha256);
      const remove=element("button","btn outline","Remove");remove.type="button";
      remove.setAttribute("aria-label","Remove hash for "+r.name);
      remove.addEventListener("click",()=>{
        records.splice(index,1);render();message("Entry removed from this session.");
      });
      card.append(title,small,hash,remove);
      list.appendChild(card);
    });
    exportButton.disabled=records.length===0;
    clearButton.disabled=records.length===0;
  }
  button.addEventListener("click",async()=>{
    const file=fileField.files?.[0];
    if(!file){message("Select a file to fingerprint first.",true);return}
    if(file.size===0||file.size>MAX_SIZE){
      message("Choose a non-empty file of 15 MB or less.",true);return;
    }
    if(records.length>=MAX_RECORDS){message("This session supports up to 12 files.",true);return}
    if(!crypto?.subtle){message("Secure browser hashing is unavailable.",true);return}
    const label=noteField.value.trim();
    if(label.length>240){message("Keep the evidence note under 240 characters.",true);return}
    button.disabled=true;
    const previous=button.textContent;button.textContent="Hashing locally…";
    try{
      const hash=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());
      const sha256=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
      if(records.some(r=>r.sha256===sha256)){
        message("This file's fingerprint is already in your local session.");return;
      }
      records.push({
        name:file.name.slice(0,180),sizeBytes:file.size,
        lastModified:new Date(file.lastModified).toISOString(),
        sha256,kind:sourceField.value,note:label,
        hashedAt:new Date().toISOString()
      });
      fileField.value="";noteField.value="";
      render();message("File hashed in this browser. The file has NOT been uploaded.");
    }catch{
      message("File fingerprint could not be generated in this browser.",true);
    }finally{button.disabled=false;button.textContent=previous}
  });
  exportButton.addEventListener("click",()=>{
    if(!records.length)return;
    const manifest={
      schema:"safekey.local-evidence-manifest.v1",
      exportedAt:new Date().toISOString(),
      disclaimer:"Fingerprints help compare file bytes. They cannot prove document authenticity, ownership, location, legality or the truth of a claim.",
      dataLocation:"Created in your browser; not sent to SafeKey.",
      entries:records
    };
    const blob=new Blob([JSON.stringify(manifest,null,2)+"\n"],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="safekey-evidence-manifest-"+new Date().toISOString().slice(0,10)+".json";
    a.click();
    // Release object URL on a later event-loop turn (click has started download).
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    message("Manifest downloaded locally. Protect the exported file; its filename and notes may be sensitive.");
  });
  clearButton.addEventListener("click",()=>{
    records=[];fileField.value="";noteField.value="";
    render();message("All manifest entries cleared from this session.");
  });
  window.addEventListener("pagehide",()=>{records=[]});
  render();
})();
