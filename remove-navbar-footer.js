const fs = require("fs");
const path = require("path");
const pagesDir = path.join("learnflow-hub", "src", "pages");
const files = ["Payment.tsx","QuizPage.tsx","Profile.tsx","Certificates.tsx","Pricing.tsx","About.tsx","Blog.tsx","Contact.tsx","Careers.tsx","HelpCenter.tsx","ForBusiness.tsx","PrivacyPolicy.tsx"];
files.forEach(f => {
  const fp = path.join(pagesDir, f);
  if (fs.existsSync(fp)) {
    let content = fs.readFileSync(fp, "utf8");
    const orig = content;
    content = content.replace(/import\s+Navbar\s+from\s+[`'"][^`'"]+[`'"];?\s*\n/g, "");
    content = content.replace(/import\s+Footer\s+from\s+[`'"][^`'"]+[`'"];?\s*\n/g, "");
    content = content.replace(/\s*<Navbar\s*\/>\s*/g, "");
    content = content.replace(/\s*<Footer\s*\/>\s*/g, "");
    if (content !== orig) { fs.writeFileSync(fp, content); console.log("Updated: " + f); }
  }
});
console.log("Complete");
