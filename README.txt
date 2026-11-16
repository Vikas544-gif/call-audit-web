DEPLOY STEPS (VS Code + GitHub + Vercel)

1. VS Code me ye poora folder (call-audit-web) kholo.
2. Terminal me: npm install
3. Keys lo:
   - GEMINI_API_KEY     -> aistudio.google.com
   - ASSEMBLYAI_API_KEY -> assemblyai.com (signup karo, dashboard me key milegi)
4. Local test: ek file .env.local banao (copy of .env.example) aur keys bharo.
   BLOB_READ_WRITE_TOKEN abhi khaali chhod do, Vercel se milega (step 7).
5. GitHub: VS Code me Source Control > Publish to GitHub (naya repo).
6. vercel.com > Add New > Project > apna GitHub repo import karo.
7. Vercel project me Storage tab > Create > Blob. Ye BLOB_READ_WRITE_TOKEN khud add kar dega.
8. Vercel > Settings > Environment Variables me ANTHROPIC_API_KEY aur ASSEMBLYAI_API_KEY daalo.
9. Deployments > Redeploy. Live link mil jayega.

NOTES
- Upload ke baad audio file transcription ke baad turant delete ho jati hai.
- History abhi us browser me save hoti hai (localStorage). Team ke liye shared history chahiye to database add karna padega.
- Customer calls ka data AssemblyAI aur Anthropic ko jata hai. Company policy / consent check kar lena.
