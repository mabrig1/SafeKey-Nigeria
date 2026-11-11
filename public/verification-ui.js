/* Private verification desk. Admin key is read from the existing password
 * input on each request and never stored in session/local storage. The
 * entire interface is for *coordination*, not legal certification. */
(() => {
  const id = name => document.getElementById(name);
  const root = id("verificationCases"), detail = id("verificationCaseDetails");
  const note = id("verificationDeskNotice");
  const newCase = id("verificationCaseForm");
  const load = id("loadVerificationCases");
  const el = (tag, text, className) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = String(text);
    if (className) n.className = className;
    return n;
  };
  const labels = {
    requested: "Requested from professional",
    received_unverified: "Material received — not authenticated",
    review_reported: "Professional review reported — not authenticated",
    needs_clarification: "Clarification required"
  };
  const evidence = [
    ["none", "None yet"],
    ["seller_document", "Seller document (unverified)"],
    ["legal_opinion_described", "Legal opinion described (not authenticated)"],
    ["survey_report_described", "Survey report described (not authenticated)"],
    ["registry_result_described", "Agency result described (not authenticated)"],
    ["site_visit_described", "Site visit described (not independently confirmed)"],
    ["agreement_described", "Agreement described (not authenticated)"]
  ];
  const jurisdictions = [
    ["lagos", "Lagos"], ["fct", "Federal Capital Territory"],
    ["enugu", "Enugu"], ["other", "Other state"]
  ];
  for (const [key, text] of jurisdictions) {
    const option = el("option", text); option.value = key;
    id("verificationJurisdiction").appendChild(option);
  }
  function message(value, success = false) {
    note.textContent = value;
    note.hidden = !value;
    note.classList.toggle("success", success);
  }
  async function api(path, opts = {}) {
    const adminKey = id("adminKey").value.trim();
    if (!adminKey) throw Error("Enter the moderator key in the field above.");
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 10000);
    try {
      const response = await fetch(path, {
        ...opts,
        credentials: "same-origin",
        signal: abort.signal,
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey }
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || "Private desk unavailable.");
      return body;
    } catch (error) {
      if (error.name === "AbortError") throw Error("The private desk request timed out.");
      throw error;
    } finally { clearTimeout(timeout); }
  }
  async function listCases() {
    const data = await api("/api/admin/verification-cases");
    root.replaceChildren();
    if (!data.cases.length) {
      root.appendChild(el("p", "No private review cases yet. Create a case using the form above.", "muted"));
      return;
    }
    for (const item of data.cases) {
      const row = el("article", undefined, "verification-case-row");
      row.appendChild(el("strong", item.kind.toUpperCase() + " · " + item.jurisdiction.toUpperCase()));
      row.appendChild(el("p", "Case ID: " + item.id + " · " + new Date(item.created_at).toLocaleString(), "muted"));
      if (item.professional_id) {
        row.appendChild(el("p", "Linked directory profile: " + item.professional_id + " (credentials not rechecked)", "muted"));
      }
      const button = el("button", "Open private review", "btn outline");
      button.type = "button";
      button.addEventListener("click", async () => {
        try { await showCase(item.id); message("Opened private case " + item.id, true); }
        catch (error) { message(error.message); }
      });
      row.appendChild(button);
      root.appendChild(row);
    }
  }
  async function showCase(caseId) {
    const data = await api("/api/admin/verification-cases/" + encodeURIComponent(caseId));
    detail.replaceChildren();
    const heading = el("h4", "Case " + data.case.id + " · " + data.case.kind.toUpperCase());
    detail.appendChild(heading);
    detail.appendChild(el("p",
      data.summary.updated + " of " + data.summary.total + " steps have recorded activity. " +
      data.summary.notice, "muted"));

    for (const task of data.summary.items) {
      const card = el("div", undefined, "verification-task");
      card.appendChild(el("strong", task.title));
      card.appendChild(el("p", "Current recorded status: " + (labels[task.status] || "Not started") +
        " · Evidence category: " + task.evidenceKind + " · Expected role: " + task.owner, "muted"));

      const field = el("div", undefined, "verification-task-controls");
      const select = el("select");
      select.setAttribute("aria-label", "Review status for " + task.title);
      for (const [value, text] of Object.entries(labels)) {
        const option = el("option", text); option.value = value;
        select.appendChild(option);
      }
      select.value = labels[task.status] ? task.status : "requested";
      const source = el("select");
      source.setAttribute("aria-label", "Evidence type for " + task.title);
      for (const [value, text] of evidence) {
        const option = el("option", text); option.value = value;
        source.appendChild(option);
      }
      source.value = task.evidenceKind;
      const button = el("button", "Record unverified review event", "btn outline");
      button.type = "button";
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await api("/api/admin/verification-cases/" + encodeURIComponent(caseId) + "/events", {
            method: "POST",
            body: JSON.stringify({checkId: task.id, status: select.value, evidenceKind: source.value})
          });
          await showCase(caseId);
          message("Review activity recorded. No title or professional identity has been certified.", true);
        } catch (error) { message(error.message); }
        finally { button.disabled = false; }
      });
      field.append(select, source, button);
      card.appendChild(field);
      detail.appendChild(card);
    }
    const audit = el("section", undefined, "verification-audit");
    audit.appendChild(el("h4", "Append-only review history"));
    if (!data.events.length) audit.appendChild(el("p", "No review events yet.", "muted"));
    for (const event of data.events) {
      audit.appendChild(el("p",
        new Date(event.created_at).toLocaleString() + " · " + event.check_id +
        " · " + (labels[event.status] || event.status) +
        " · " + event.evidence_kind, "muted"));
    }
    detail.appendChild(audit);
  }

  load.addEventListener("click", async () => {
    load.disabled = true;
    try { await listCases(); message("Loaded private cases. All findings remain unverified.", true); }
    catch (error) { message(error.message); }
    finally { load.disabled = false; }
  });

  newCase.addEventListener("submit", async event => {
    event.preventDefault();
    const button = id("verificationCreate");
    button.disabled = true;
    const selected = id("verificationProfessional").value;
    try {
      const data = await api("/api/admin/verification-cases", {
        method: "POST",
        body: JSON.stringify({
          kind: id("verificationKind").value,
          jurisdiction: id("verificationJurisdiction").value,
          ...(selected ? { professionalId: selected } : {})
        })
      });
      message("Private case " + data.id + " created. Save the case ID in your own offline client record.", true);
      await listCases();
      await showCase(data.id);
    } catch (error) { message(error.message); }
    finally { button.disabled = false; }
  });

  id("loadVerificationProfessionals").addEventListener("click", async () => {
    const select = id("verificationProfessional");
    try {
      const response = await fetch("/api/professionals", { credentials: "same-origin" });
      if (!response.ok) throw Error("Professional directory is not available.");
      const data = await response.json();
      select.replaceChildren();
      const none = el("option", "Unassigned"); none.value = ""; select.appendChild(none);
      for (const pro of data.professionals || []) {
        const option = el("option", pro.name + " — " + pro.profession + " (" + pro.city + ")");
        option.value = pro.id; select.appendChild(option);
      }
      message("Loaded currently listed profiles. Recheck any credentials independently.", true);
    } catch (error) { message(error.message); }
  });
})();
