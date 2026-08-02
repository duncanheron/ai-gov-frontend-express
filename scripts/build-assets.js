const fs = require("node:fs");
const path = require("node:path");
const sass = require("sass");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const govukDist = path.join(root, "node_modules", "govuk-frontend", "dist", "govuk");
const mojDist = path.join(root, "node_modules", "@ministryofjustice", "frontend", "moj");

function copy(from, to) {
  fs.cpSync(from, to, { recursive: true });
}

fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });

// Stylesheets
const cssOutDir = path.join(publicDir, "stylesheets");
fs.mkdirSync(cssOutDir, { recursive: true });
// `root` is a load path because MoJ Frontend forwards govuk-frontend by the
// literal path "node_modules/govuk-frontend/...", which node_modules alone
// cannot resolve.
const result = sass.compile(path.join(root, "src", "assets", "scss", "main.scss"), {
  loadPaths: [path.join(root, "node_modules"), root],
  style: "compressed",
  quietDeps: true,
});
fs.writeFileSync(path.join(cssOutDir, "main.css"), result.css);

// JavaScript
const jsOutDir = path.join(publicDir, "javascripts");
fs.mkdirSync(jsOutDir, { recursive: true });
copy(path.join(govukDist, "govuk-frontend.min.js"), path.join(jsOutDir, "govuk-frontend.min.js"));
copy(
  path.join(govukDist, "govuk-frontend.min.js.map"),
  path.join(jsOutDir, "govuk-frontend.min.js.map"),
);
copy(
  path.join(root, "src", "assets", "javascripts", "application.js"),
  path.join(jsOutDir, "application.js"),
);
// The minified bundle, not `all.bundle.mjs`: that one still imports the bare specifier
// "govuk-frontend", which no browser resolves without an import map, so it would fail at
// runtime while looking perfectly reasonable here. This one inlines its own copy of the
// framework instead - roughly 70KB duplicated on caseworker pages, accepted.
copy(path.join(mojDist, "moj-frontend.min.js"), path.join(jsOutDir, "moj-frontend.min.js"));
copy(path.join(mojDist, "moj-frontend.min.js.map"), path.join(jsOutDir, "moj-frontend.min.js.map"));

// Static assets (fonts, images, manifest)
const assetsOutDir = path.join(publicDir, "assets");
fs.mkdirSync(assetsOutDir, { recursive: true });
copy(path.join(govukDist, "assets", "images"), path.join(assetsOutDir, "images"));
copy(path.join(govukDist, "assets", "fonts"), path.join(assetsOutDir, "fonts"));
copy(path.join(govukDist, "assets", "manifest.json"), path.join(assetsOutDir, "manifest.json"));

console.log("Assets built into public/");
