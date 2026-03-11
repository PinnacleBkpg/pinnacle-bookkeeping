# Pinnacle Bookkeeping Services Ltd. — Website

**pinnacle.bkpg** | Thunder Bay, Ontario | [amitb.bkpg@gmail.com](mailto:amitb.bkpg@gmail.com) | (807) 356-6173

---

## Pages

| File | Page | Description |
|------|------|-------------|
| `index.html` | Home | Hero, services overview, industries, process, benefits, CTA |
| `about.html` | About | Mission, philosophy, values, who we serve |
| `services.html` | Services | Bookkeeping, Payroll, Compliance, Reporting, QuickBooks, Catch-Up |
| `industries.html` | Industries | Restaurants, Contractors, Retail, Service Businesses, Professional Services |
| `faq.html` | FAQ | 15 questions across 4 categories |
| `contact.html` | Contact | Contact form, phone, email, Calendly link |
| `client-portal.html` | Client Portal | Secure document upload info + portal access button |
| `quote-calculator.html` | Quote Calculator | Multi-step interactive pricing calculator with EmailJS |
| `portal-login.html` | Portal Login | Secure login page for existing clients |
| `404.html` | Not Found | Custom error page |

---

## Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `pinnacle-bookkeeping`)
2. Upload all files, keeping the folder structure:
   ```
   /
   ├── index.html
   ├── about.html
   ├── services.html
   ├── industries.html
   ├── faq.html
   ├── contact.html
   ├── client-portal.html
   ├── quote-calculator.html
   ├── portal-login.html
   ├── 404.html
   ├── sitemap.xml
   ├── css/
   │   └── styles.css
   └── js/
       └── script.js
   ```
3. Go to **Settings → Pages → Source: main branch → / (root)**
4. Site goes live at `https://yourusername.github.io/pinnacle-bookkeeping`

### Custom Domain (optional)
- In GitHub Pages settings, add your custom domain (e.g. `pinnaclebookkeeping.ca`)
- Add a CNAME file to the repo root containing just your domain name
- Update DNS at your registrar: `CNAME @ yourusername.github.io`
- Update `sitemap.xml` with your real domain

---

## EmailJS Configuration (Quote Calculator)

The quote calculator uses EmailJS. Current config in `quote-calculator.html`:

```
Service ID:  service_s0g7o6e
Public Key:  KJa5WAbgn2TMjCh5f
Template 1 (to Amit):    template_6cch9j8
Template 2 (to client):  template_fepa0dl
```

---

## Tech Stack

- **HTML5** — semantic, accessible markup
- **CSS3** — custom properties, grid, flexbox, no frameworks
- **Vanilla JS** — mobile nav, FAQ accordion, scroll reveal, form handling
- **Fonts** — Playfair Display (display) + DM Sans (body) via Google Fonts
- **Email** — EmailJS (quote calculator)
- **Booking** — Calendly (`https://calendly.com/amitb-bkpg`)

---

## Brand

- Navy: `#1B3F7A` / `#0c1f42`
- Blue: `#4A72B8`
- Gold: `#c9a84c`
- Light BG: `#E6EDF8`

*"Bookkeeping with brains & jokes." — Pinnacle Bookkeeping Services Ltd.*
