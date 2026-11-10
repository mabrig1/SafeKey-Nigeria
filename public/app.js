/* SafeKey pilot UI: all untrusted content is inserted as text, never HTML. */
const byId = (id) => document.getElementById(id);
const element = (tag, cls, content) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (content !== undefined) node.textContent = String(content);
  return node;
};
const add = (parent, ...children) => { for (const child of children) parent.appendChild(child); return parent; };
function notice(target, message, success = false) {
  target.textContent = message;
  target.classList.toggle("success", success);
  target.hidden = !message;
}
async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, { ...options, signal: controller.signal, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    let body;
    try { body = await response.json(); } catch { throw new Error("The server returned an unreadable response."); }
    if (!response.ok) throw new Error(body.error || "The request could not be completed.");
    return body;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("This request timed out. Try again.");
    throw error;
  } finally { clearTimeout(timeout); }
}
function busy(button, enabled, waitingLabel) {
  if (!button.dataset.original) button.dataset.original = button.textContent;
  button.disabled = enabled;
  button.textContent = enabled ? waitingLabel : button.dataset.original;
}
function renderAssessment(report) {
  const root = byId("checkResult"); root.replaceChildren();
  const top = element("div", "result-top");
  const intro = element("div");
  add(intro, element("span", "section-kicker", "YOUR PRELIMINARY REPORT"),
    element("h3", "", report.heading || "Verification required"),
    element("p", "", report.description || ""));
  add(top, intro, element("span", "report-tag", report.level === "elevated_caution" ? "ELEVATED CAUTION" : "NOT VERIFIED"));
  const cols = element("div", "result-columns"), left = element("div"), right = element("div");
  left.appendChild(element("h4", "", "Potential warning signals"));
  if (!report.findings || !report.findings.length) {
    add(left, element("p", "muted", "No warning patterns detected in the supplied information. This does not establish that the deal is safe."));
  } else {
    for (const item of report.findings) {
      const block = element("div", "finding");
      add(block, element("strong", "", item.title), element("p", "", item.detail),
        element("small", "", "Source: " + item.source + " · Confidence: " + item.confidence));
      left.appendChild(block);
    }
  }
  right.appendChild(element("h4", "", "Essential checks not yet completed"));
  for (const item of report.checks || []) {
    const row = element("div", "verify-item");
    add(row, element("strong", "", item.name), element("span", "", item.status), element("p", "", item.note));
    right.appendChild(row);
  }
  add(cols, left, right);
  const foot = element("div", "result-foot");
  foot.appendChild(element("strong", "", "Next steps before payment"));
  const list = element("ol");
  for (const step of report.nextSteps || []) add(list, element("li", "", step));
  foot.appendChild(list);
  foot.appendChild(element("p", "muted", report.disclaimer || ""));
  const meta = element("p", "result-meta", "Reference: " + report.caseId + " · Issued: " + new Date(report.issuedAt).toLocaleString() + " · Input-based screening only");
  const print = element("button", "btn outline print-btn", "Print / save this report");
  print.type = "button"; print.addEventListener("click", () => window.print());
  add(root, top, cols, foot);
  if (report.aiAssist) {
    const aiBox = element("section", "result-foot");
    aiBox.appendChild(element("strong", "", "AI-assisted questions for independent verification"));
    if (report.aiAssist.status === "available" && report.aiAssist.questions?.length) {
      const list = element("ol");
      for (const question of report.aiAssist.questions) list.appendChild(element("li", "", question));
      aiBox.appendChild(list);
      aiBox.appendChild(element("p", "muted", report.aiAssist.note));
    } else {
      aiBox.appendChild(element("p", "muted",
        report.aiAssist.status === "disabled"
          ? "AI assistance has not been enabled for this pilot."
          : "AI assistance is unavailable; the rule-based screening report remains valid as a preliminary assessment."));
    }
    root.appendChild(aiBox);
  }
  add(root, meta, print);
  root.hidden = false; root.focus(); root.scrollIntoView({ behavior: "smooth", block: "start" });
}
byId("year").textContent = String(new Date().getFullYear());
byId("checkForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  notice(byId("checkError"), "");
  const button = byId("checkSubmit"); busy(button, true, "Assessing supplied information…");
  const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  values.aiExplain = byId("aiExplain").checked;
  try {
    const report = await api("/api/check", { method: "POST", body: JSON.stringify(values) });
    renderAssessment(report);
  } catch (error) {
    notice(byId("checkError"), error.message);
    byId("checkResult").hidden = true;
  } finally { busy(button, false); }
});
byId("reportForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = byId("reportMessage");
  notice(message, "");
  if (!byId("reportConsent").checked) { notice(message, "Please read and accept the privacy terms."); return; }
  const button = byId("reportSubmit"); busy(button, true, "Submitting…");
  const b = Object.fromEntries(new FormData(event.currentTarget).entries());
  b.consent = byId("reportConsent").checked;
  b.evidenceKind = b.evidenceKind || "none";
  try {
    const result = await api("/api/reports", { method: "POST", body: JSON.stringify(b) });
    event.currentTarget.reset();
    notice(message, "Received for private review. Case reference: " + result.reference + ". This is not a regulator complaint.", true);
  } catch (error) { notice(message, error.message); }
  finally { busy(button, false); }
});
async function loadProfessionals() {
  const root = byId("professionalDirectory");
  root.replaceChildren(element("p", "muted", "Loading vetted directory…"));
  try {
    const data = await api("/api/professionals");
    root.replaceChildren();
    if (!data.professionals.length) {
      const empty = element("div", "empty-state");
      add(empty, element("strong", "", "No verified professional profiles published yet."),
        element("p", "", "The directory starts empty by design. SafeKey will not invent legal or survey credentials. Use an official professional register to find and verify advisers in the meantime."));
      root.appendChild(empty);
      return;
    }
    for (const p of data.professionals) {
      const card = element("article", "pro-card");
      add(card, element("small", "", p.profession + " · " + p.city),
        element("h3", "", p.name), element("p", "", p.credential_label),
        element("p", "muted", "Evidence reviewed: " + new Date(p.verified_at).toLocaleDateString()));
      const anchor = element("a", "", "View credential evidence ↗");
      anchor.href = p.evidence_url; anchor.target = "_blank"; anchor.rel = "noopener noreferrer";
      card.appendChild(anchor); root.appendChild(card);
    }
  } catch (error) {
    root.replaceChildren();
    const empty = element("div", "empty-state");
    add(empty, element("strong", "", "Directory unavailable"), element("p", "", error.message));
    root.appendChild(empty);
  }
}
byId("refreshPros").addEventListener("click", loadProfessionals);
loadProfessionals();
const adminKey = () => byId("adminKey").value.trim();
const adminRequest = (path, options = {}) => api(path, { ...options, headers: { "X-Admin-Key": adminKey(), ...(options.headers || {}) } });
function renderReports(reports) {
  const root = byId("adminReports"); root.replaceChildren();
  if (!reports.length) { root.appendChild(element("p", "muted", "No submitted reports.")); return; }
  root.appendChild(element("h3", "", "Private moderation queue (" + reports.length + ")"));
  for (const report of reports) {
    const card = element("article", "admin-report");
    add(card, element("h4", "", report.category + " · " + report.status), element("p", "muted", report.area + " · " + report.created_at + " · ID " + report.id),
      element("p", "", report.description), element("p", "muted", "Evidence described: " + report.evidence_kind));
    if (report.reviewer_note) card.appendChild(element("p", "muted", "Previous review: " + report.reviewer_note));
    const select = element("select");
    for (const choice of ["needs_more_evidence", "closed_unsubstantiated", "substantiated", "referred"]) {
      const opt = element("option", "", choice.replaceAll("_", " ")); opt.value = choice; select.appendChild(opt);
    }
    const note = element("textarea"); note.rows = 2; note.placeholder = "Evidence and rationale (minimum 8 characters)";
    const action = element("button", "btn outline", "Save private review"); action.type = "button";
    action.addEventListener("click", async () => {
      busy(action, true, "Saving…");
      try {
        await adminRequest("/api/admin/reports/decision", { method: "POST", body: JSON.stringify({ id: report.id, status: select.value, note: note.value }) });
        notice(byId("adminNotice"), "Review saved for " + report.id, true);
        await refreshReports();
      } catch (error) { notice(byId("adminNotice"), error.message); }
      finally { busy(action, false); }
    });
    add(card, select, note, action); root.appendChild(card);
  }
}
async function refreshReports() {
  const response = await adminRequest("/api/admin/reports");
  renderReports(response.reports || []);
}
byId("loadReports").addEventListener("click", async () => {
  notice(byId("adminNotice"), "");
  try { await refreshReports(); notice(byId("adminNotice"), "Loaded private moderation queue.", true); }
  catch (error) { notice(byId("adminNotice"), error.message); }
});
byId("professionalForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    await adminRequest("/api/admin/professionals", { method: "POST", body: JSON.stringify(data) });
    event.currentTarget.reset();
    notice(byId("adminNotice"), "Professional added to directory. Re-verify credentials regularly.", true);
    loadProfessionals();
  } catch (error) { notice(byId("adminNotice"), error.message); }
});
