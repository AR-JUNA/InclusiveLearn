# InclusiveLearn Africa

InclusiveLearn Africa is a standalone, browser-based learning prototype for students, educators, parents, and administrators. It demonstrates an inclusive learning flow: educators create learning materials, administrators review them, approved items appear in student learning spaces, and families and educators can communicate about progress.

This repository folder is the **second project** and runs independently. It is built with plain HTML, CSS, and JavaScript plus a small Node.js server. It does not require React, a database server, or package installation.

## The problem and proposed solution

Learners with disabilities can face barriers to quality education when digital learning tools do not support accessibility needs, local languages, intermittent connectivity, or family and educator collaboration. The SRS identifies accessible content, offline use, assistive technologies, multilingual support, progress reporting, and communication as central needs.

InclusiveLearn brings these needs into one web experience. Learners can find lessons, use available assistive features, save material for offline access, complete quick checks, and follow their progress. Educators can create full learning resources and assignments, communicate with families, and view classroom progress. Administrators can review and approve or reject submitted content before it is shown to learners.

## Main capabilities

### Accounts and role spaces

- Students, educators, and parents can register and sign in with an email address or phone number and password.
- Each role has a separate navigation and dashboard. A user signs out before entering a different role.
- Administrator registration is not offered. A local prototype admin account is created on first server start (credentials below).
- Google and Facebook login buttons require OAuth application credentials and callback URLs. They are optional and will not work until configured.

### Profiles and accessibility

- Profile and settings include text-size and contrast options, language selection, read-aloud controls, and speech input where the browser supports it.
- Read aloud uses the browser's speech synthesis. Speech recognition availability and language quality depend on the browser, device, microphone, and installed language models.

### Learning library and lessons

- Search and filter by subject, grade, language, and media type.
- The sample material includes English lessons and lessons in Yorùbá, Kiswahili, and French.
- Lessons include reading content and a five-question quick check. Some lessons include video material; playback depends on the browser and video provider.
- Students can complete lesson activities, submit assignment responses, and view progress.

### Educator and administrator workflow

- Educators can create a complete lesson, project, or assignment with fields such as learning objectives, content, activities, and assessment criteria.
- Submissions enter the administrator content review queue.
- Administrators can approve or reject content. Approved materials become visible in the student library; educators and administrators can remove published content.
- Educators can send messages and family learning updates. The recipient appears in the message workflow and the update is delivered to the recipient's inbox and notification area.
- Admin usage reporting and role-specific progress reports can be downloaded as CSV files.

### Parent connection and communication

- Parents can request a learner link using the learner's account email or phone number.
- The learner must approve the request before their progress is shared with the parent.
- Parent-to-educator messages appear in the educator's inbox, and message notifications open the relevant messages area.

### Offline support

- The service worker caches the application shell and selected resources for later access.
- Learning progress is queued locally and synchronized with the server when the browser reconnects.
- Offline support depends on using the website through its local HTTP server. Opening `index.html` directly as a file will not provide the full account or service-worker behavior.

## Run the project

### Requirements

- Node.js 18 or newer
- A modern browser such as Chrome, Edge, Firefox, or Safari

### Start

1. Open this folder in VS Code.
2. Open a terminal in this folder.
3. Run:

   ```bash
   npm run dev
   ```

4. Open the exact `http://localhost:PORT` address printed in the terminal.

The server uses Node's built-in modules, so `npm install` is not required. The default port is 3000. If it is occupied, the server tries the next available port and prints the final address. Use **Ctrl+C** in the terminal to stop that server. If you have run several copies, stop the older terminals and keep one server running.

To use a specific port, set `PORT` before starting. If that port is occupied, the server exits with an address-in-use error rather than selecting another port.

### Local administrator sign-in

A fresh local server creates this prototype account automatically:

- **Email:** `admin@inclusivelearn.africa`
- **Password:** `admin@123`
- **Role:** Admin

These are demo credentials for local coursework. Change them before sharing or deploying the project. To set a custom admin account on a fresh data store, set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 12 characters), and optionally `ADMIN_NAME` before the first run. Keep credentials private.

## Local data and security notes

The server stores accounts, messages, and shared platform records as JSON files in the `.data` folder beside `server.js`. Student progress and preferences are synchronized through the local server. The `.data` folder is created at runtime and is not included in the downloadable source ZIP.

Passwords are stored as salted scrypt hashes, and signed-in sessions use an HTTP-only cookie. The local prototype is not a production deployment: it does not use a managed database, production session store, HTTPS configuration, formal account verification, or full privacy-compliance workflows. Do not use real student records or sensitive personal information. A real deployment would need security review, secure hosting, backups, consent and safeguarding processes, a production database, and provider-specific OAuth setup.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Website entry point and page metadata |
| `styles.css` | Responsive layouts, components, accessibility preferences, and visual styling |
| `app.js` | Lessons, dashboards, account flows, interactions, accessibility, and browser-side synchronization |
| `icons.js` | Local icon rendering helpers |
| `server.js` | Node.js HTTP server, authentication, role-aware API routes, and local JSON persistence |
| `sw.js` | Service worker for caching the app shell and supporting offline access |
| `manifest.json` | Web-app name and display metadata |
| `icon.svg` | Website icon |
| `learning-classroom-hero.png` | Homepage classroom image |
| `DEMO-GUIDE.md` | Short demonstration flow and requirement map |
| `package.json` | Project name and start scripts |
| `.gitignore` | Excludes local runtime data and dependency folders |

## SRS coverage and current scope

The prototype demonstrates the ten main functional requirement areas: accounts, profile preferences, categorized learning content, offline caching and progress sync, text-to-speech and speech input, language switching, educator tools, quizzes and assignments, progress and reports, and role-aware messages. It also includes content review and publication.

The current interface includes English, Yorùbá, Kiswahili, and French. The SRS describes support for at least five African languages, so adding and reviewing a fifth language and translated lesson set remains future work. Social login also needs external provider configuration. These are prototype scope limits, not completed features.

