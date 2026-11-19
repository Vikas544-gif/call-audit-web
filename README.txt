SALES CALL AUDIT - SETUP

SEPARATE PAGES
  /audit       Audit page: upload calls, run audits (3 calls at the same time)
  /dashboard   Dashboard: KPIs, charts, agent-wise report (all scores in %), summaries      (admin)
  /calls       Audited calls: every call with customer, contact ID and mistakes; "By agent" view  (admin)
  /mistakes    AI Mistakes: mistakes the AI found on its own (not only parameters), with quote, time and fix   (admin)
  /followups   Follow-ups: what the Trainer and the TLs have to do and have done              (admin)
  /settings    Settings: agents, centers, parameters + owners, mandatory statements, emails    (admin)
  /            Small start page with all the links
  Filters (Center, TL, Agent slicers and the rest) are shared between Dashboard and Audited calls in the same browser tab.

PASSWORDS (Vercel > Settings > Environment Variables)
  DASH_PASSWORD   = admin. Opens everything.
  AUDIT_PASSWORD  = auditors. Opens ONLY the Audit page. The server blocks them from the Dashboard,
                    other people's audits, settings and emails, even if they type the dashboard link.
  If DASH_PASSWORD is not set, anyone with the link can open everything.

VERCEL SETUP
1. Storage > Create Database > Upstash (Redis) > Free > Connect to this project.
2. Storage > Create > Blob (for the audio upload).
3. Environment Variables: GEMINI_API_KEY, ASSEMBLYAI_API_KEY, DASH_PASSWORD, AUDIT_PASSWORD,
   MAIL_USER (Gmail address) and MAIL_PASS (Gmail app password, 16 letters).
4. Deployments > latest > Redeploy.

AFTER THE FIRST DEPLOY (Dashboard > Settings)
- Agent mapping: Center, Agent, TL, Agent email, TL email.
- Email and follow-ups: Trainer email, CC (manager), weak limit %, training loop mode and QA email.
- Scoring parameters: weightage, the question for the AI, and the OWNER (Trainer or TL) of each parameter.
- Mandatory statements and Scoring calibration.

HOW A CALL IS HANDLED
1. Auditor picks the agent, types Customer name and Contact ID, uploads one or many calls.
   Strategy and Call status are "Auto (AI decides)" by default: the AI reads the call and fills them. The auditor can still pick a value by hand. Call type is always chosen by the auditor.
2. The AI scores every parameter, lists mistakes (with the line from the call and a better reply),
   checks the mandatory statements yes / partial / no. All feedback is in English.
3. The result shows on screen at once. Emails go out in the background:
   - Agent gets the audit feedback (TL and CC in copy).
   - Every weak parameter (below the weak limit) is routed to its OWNER automatically:
       Trainer-owned parameters -> Trainer gets a "Training needed" mail with a form.
       TL-owned parameters      -> the agent's TL gets a "Coaching needed" mail with a form.
     Default: INTRODUCTION and INVESTOR PROFILING/PROBING = Trainer, everything else = TL.
     Change the owner of any parameter in Settings and the routing follows.
4. When the Trainer / TL submits the form, the agent gets an acknowledgement link
   (Draft = QA inbox gets a ready draft, Auto = goes to the agent directly, Off).
5. Everything shows on the Dashboard under Follow-ups.

DESIGN: light header with a plain nav, one light filter panel (active filters show as chips you can remove), numbers in one ruled strip, charts on one ruled sheet. Only weak (below the weak limit) and strong (80%+) cells are coloured. Each call opens with a call timeline: two lanes (Agent, Customer), the late-opening gap and the mistakes at their time. Font: IBM Plex Sans.

THEMES: the "Theme" button at the top: 8 themes (Light, Dark, Ocean, Forest, Sunset, Purple, Slate, High contrast) and your own accent colour. Remembered per browser.

CALL SCRIPT: every audit saves the call script with [mm:ss] times and Agent / Customer labels. Open a call and press "Show call script" (mistake lines are marked red).

OPENING DELAY RULE (Settings): if the agent starts speaking later than the allowed seconds after the customer picks up, the opening parameter score goes down and a "delayed opening" mistake is added.

LISTEN BEFORE YOU AUDIT: on the Audit page every chosen call gets a box with its length (mm:ss) and a player, so the auditor can listen first. After the audit, open the call in "Your audits in this session": a player appears and a click on a script line or a mistake time plays the call from there. The recording stays only in the browser tab (it is not stored on the server; the audio is deleted after transcription). The call length is saved with each audit.

SPEED / QUALITY SWITCHES (Vercel environment variables, all optional)
  GEMINI_THINKING = low (default) | off | default   low = faster. Use "default" if you feel the scoring got less careful.
  AAI_LANGUAGE    = hi or en    skips language detection: faster, and often better when most calls are in one language.
  GEMINI_MODEL    = the Gemini model name to use.

NOTES
- Audio is deleted right after transcription.
- Customer call data goes to AssemblyAI and Gemini. Check your company policy / consent.
- Gmail allows about 500 mails a day.
- If two people edit Settings at the same moment, the last save wins.
- Old links /dashboard.html and /audit.html redirect to the new pages.
