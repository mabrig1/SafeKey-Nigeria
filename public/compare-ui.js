/* Comparative screening UX. Untrusted API fields render via textContent only. */
(() => {
  const $ = id => document.getElementById(id);
  const item = (tag, cls, text) => {
    const e=document.createElement(tag);
    if(cls) e.className=cls;
    if(text !== undefined) e.textContent=String(text);
    return e;
  };
  const append=(parent,...nodes)=>{nodes.forEach(n=>parent.appendChild(n));return parent};
  const fields=["area","address","plot","listingUrl","agentPhone","advertiserName","paymentName","priceNgn"];
  const form=$("compareForm"),result=$("compareResult"),error=$("compareError"),submit=$("compareSubmit");
  function readSide(prefix) {
    return Object.fromEntries(fields.map(name=>[name,$(prefix+name).value.trim()]));
  }
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    result.hidden=true;
    error.hidden=true;
    const original=submit.textContent;
    submit.disabled=true; submit.textContent="Comparing supplied details…";
    try {
      const abort=new AbortController();
      const timer=setTimeout(()=>abort.abort(),12000);
      let response;
      try {
        response=await fetch("/api/compare",{
          method:"POST",credentials:"same-origin",
          headers:{"Content-Type":"application/json"},
          signal:abort.signal,
          body:JSON.stringify({first:readSide("one"),second:readSide("two")})
        });
      } finally {clearTimeout(timer)}
      const data=await response.json();
      if(!response.ok) throw Error(data.error || "Unable to compare listings.");
      result.replaceChildren();
      const heading=item("h3","",data.possibleMatch
        ? "Matching textual reference — investigate differences"
        : "Property identity not established");
      result.appendChild(heading);
      result.appendChild(item("p","muted","This comparison uses only the information you entered. It does not fetch listings, access official registries, or certify anyone's identity."));
      if(data.signals?.length){
        const list=item("div","comparison-findings");
        for(const s of data.signals){
          const block=item("div","finding");
          append(block,item("strong","",s.title),item("p","",s.explanation),
            item("small","",s.source+" · "+(s.priority==="review"?"Needs clarification":"Information only")));
          list.appendChild(block);
        }
        result.appendChild(list);
      }
      result.appendChild(item("h4","","Independent follow-up checks"));
      const ol=item("ol","");
      for(const line of data.guidance || []) ol.appendChild(item("li","",line));
      result.appendChild(ol);
      result.appendChild(item("p","muted",data.disclaimer));
      result.hidden=false;
      result.focus();result.scrollIntoView({block:"start",behavior:"smooth"});
    } catch(e){
      error.textContent=e?.name==="AbortError" ? "Request timed out; try again." : e.message;
      error.hidden=false;
    } finally {submit.disabled=false;submit.textContent=original}
  });
})();
