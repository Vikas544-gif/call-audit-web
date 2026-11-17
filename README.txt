SALES CALL AUDIT - SETUP

TWO SEPARATE PAGES
  https://YOUR-APP.vercel.app/audit       Audit page: upload calls, run audits (fast: 3 calls at the same time)
  https://YOUR-APP.vercel.app/dashboard   Dashboard: scores, slicers, follow-ups, Settings (admin only)
  https://YOUR-APP.vercel.app/            Small start page with both links

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

THEMES: the round buttons at the top (Light, Dark, Ocean, Forest). The choice is remembered per browser.

NOTES
- Audio is deleted right after transcription.
- Customer call data goes to AssemblyAI and Gemini. Check your company policy / consent.
- Gmail allows about 500 mails a day.
- If two people edit Settings at the same moment, the last save wins.
- Old links /dashboard.html and /audit.html redirect to the new pages.
