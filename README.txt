SALES CALL AUDIT - SETUP

ONE link for everyone: https://YOUR-APP.vercel.app  (opens the dashboard)
Everyone uses the same DASH_PASSWORD. All audits are saved in one shared database,
so every audit anyone runs shows up on the dashboard.

VERCEL SETUP (Project > Settings / Storage)
1. Storage > Create Database > Upstash (Redis) > Free > Connect to this project.
   (adds KV_REST_API_URL and KV_REST_API_TOKEN automatically)
2. Storage > Create > Blob  (adds BLOB_READ_WRITE_TOKEN automatically)
3. Settings > Environment Variables, add:
   GEMINI_API_KEY, ASSEMBLYAI_API_KEY
   DASH_PASSWORD   (the password everyone will type)
   MAIL_USER       (Gmail address that sends the mails)
   MAIL_PASS       (Gmail "App password", 16 letters)
4. Deployments > latest > Redeploy.

GMAIL APP PASSWORD
Google Account > Security > turn on 2-Step Verification > App passwords > name it "call audit" > copy the 16-letter code.
Gmail allows about 500 mails per day.

AFTER FIRST DEPLOY (Admin Settings tab)
- Agent mapping: fill Agent email and TL email for every agent (otherwise "Agent email is not set").
- Email and training alerts: fill Trainer email and optional CC (manager), and the alert limit %.
- Data that was saved earlier in your own browser is copied to the shared database the first time
  you open the dashboard on that same browser.

HOW IT WORKS
- After each audit the agent gets the feedback mail (TL and CC in copy).
- If the score is below the alert limit, the trainer gets a "Submit training plan" mail.
  The trainer fills the form (no password needed, the link is private) and it shows under "Training Follow-ups".
- Slicers (Center, Team Leader, Agent) at the top filter the whole dashboard. You can pick more than one.
- Every call has its own box. Click it to see the mistakes, the line from the call and the better reply.

NOTES
- Audio is deleted right after transcription.
- Customer call data goes to AssemblyAI and Gemini. Check your company policy / consent.
- If two people edit Admin Settings at the same moment, the last save wins.
