const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DEBUG_PORT = process.env.CDP_PORT || "9222";
const PROFILE = process.env.CDP_PROFILE || "C:\\Users\\faiders\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 1";

const { spawn } = await import('child_process');
const args = [
  `--user-data-dir=${PROFILE}`,
  `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-first-run",
  "--no-default-browser-check",
  "https://crm.dropi.co/"
];
const child = spawn(CHROME, args, { detached: true, stdio: 'ignore' });
child.unref();
console.log(`Chrome CDP started on port ${DEBUG_PORT} with profile ${PROFILE}`);
console.log(`Target: https://crm.dropi.co/`);
console.log('If it does not open / you need your logged-in profile, edit CDP_PROFILE in launch-chrome.ps1');
