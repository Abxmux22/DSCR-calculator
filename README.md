# DSCR Calculator

Python-hosted DSCR real estate calculator with live T12 and five-year projections, Sale and IRR analysis, and a multi-page investor PDF report.

## Features

- Historical T12 and Projected Years 1-5
- Live Net Income, NOI, ratios, DSCR, cash flow, LP/GP distributions, and annual cash-on-cash
- Sale proceeds and LP/GP profit allocation
- Investor IRR schedule and calculation
- Multi-page PDF with a T12/Years 1-5 comparison matrix, executive summary, charts, Sale, IRR, logo, and page numbers
- Responsive layout suitable for embedding in a GoHighLevel iframe
- Temporary Autofill Test Data control (excluded from PDFs)

## Production Files

- `index.html` - calculator form and live result containers
- `styles.css` - responsive styling
- `app.js` - formulas, live rendering, autofill, and PDF request payload
- `backend/server.py` - static server and PDF generator
- `assets/logo-header.jpg` - report logo
- `render.yaml` - Render Blueprint configuration
- `requirements.txt` - Python dependency manifest

## Run Locally

Requirements: Python 3.11 or newer.

```powershell
python backend\server.py
```

Open [http://localhost:8000](http://localhost:8000).

No Node.js or npm installation is required.

## Publish to GitHub

Git is not currently available in this PC's terminal. Install Git for Windows or use GitHub Desktop, then reopen the terminal.

1. Create a new empty repository on GitHub. Do not initialize it with a README, `.gitignore`, or license.
2. Open PowerShell in this project directory.
3. Run:

```powershell
git init -b main
git add .
git commit -m "Deploy DSCR calculator"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

If Git asks for your identity first:

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Do not commit passwords, API keys, or private `.env` files.

## Deploy to Render

The root `render.yaml` is ready for a Render Blueprint.

1. Sign in to Render and connect your GitHub account.
2. Select **New > Blueprint**.
3. Connect the GitHub repository you created.
4. Keep the Blueprint path as `render.yaml`.
5. Review the `dscr-calculator` web service and click **Deploy Blueprint**.
6. Wait for the health check to pass.
7. Open the generated URL, such as `https://dscr-calculator.onrender.com`.

Render automatically supplies `PORT`. The Python server binds to `0.0.0.0` and reads that environment variable.

## Embed in GoHighLevel

Replace the example URL with your Render service URL:

```html
<iframe
  src="https://YOUR-SERVICE.onrender.com"
  title="DSCR Calculator"
  width="100%"
  height="5200"
  loading="lazy"
  style="border:0; width:100%;"
></iframe>
```

Adjust the iframe height in GHL if the mobile layout needs more vertical space. The Python server sends an iframe-compatible `Content-Security-Policy` header.

## Render Free-Plan Note

Free Render web services may sleep after inactivity and take approximately one minute to wake. Their filesystem is ephemeral, so saved server-side report history can disappear after restarts or redeploys. PDF downloads still generate and return immediately to the user.
