
import { testStr, restartAPP } from './manage-utils.js'

const main = document.querySelector("#main");
const template = document.querySelector('#app-list');
const save2Local = document.querySelector("#save2Local")
const clearlocalstorage = document.querySelector("#clearlocalstorage");
clearlocalstorage.addEventListener('click', ()=>{
    localStorage.clear();
})
// const accounts = [];
const accountsStr = localStorage.getItem("accounts");
const accounts = new Set(JSON.parse(accountsStr) || []);
for (const account of accounts) {
    addAccount(account);
}
document.querySelector("#addKey")?.addEventListener(
    'click',
    async () => {
        /** @type string*/
        const key = document.getElementById("key")?.value;
        if (key && accounts.has(key) === false) {
            await addAccount(key);
        }
    }
)


async function addAccount(key) {
    const clone = template.content.cloneNode(true);
    const keySpan = clone.querySelector("div>.key");
    keySpan.textContent = "****" + key.slice(4);

    const resp = await fetch("https://api.heroku.com/apps", {
        method: "Get",
        headers: {
            Accept: "application/vnd.heroku+json; version=3",
            Authorization: `Bearer ${key}`
        }
    });

    /** @type any[] */
    const jsonContent = await resp.json();
    console.log(jsonContent);

    if (save2Local.checked && resp.ok) {
        const appStr = localStorage.getItem("accounts") || '[]';
        const appSet = new Set(JSON.parse(appStr)).add(key);
        const apps = [...appSet];
        localStorage.setItem("accounts", JSON.stringify(apps));

        console.log(localStorage.getItem("accounts"));
    }

    const appsUl = clone.querySelector("UL.app-list");
    for (const app of jsonContent) {
        const appli = document.createElement('li');
        appli.classList.add("appli");
        const restartBtn = document.createElement('button');
        restartBtn.dataset.appname = app.name;

        restartBtn.addEventListener('click', (event) => {
            restartAPP(app.name, key);
        });
        restartBtn.textContent = "restart";
        const url = document.createElement('a');
        url.href = app.web_url;
        url.textContent = app.web_url;

        appli.textContent = `app: ${app.name}`;
        appli.appendChild(url);
        appli.appendChild(restartBtn);
        appsUl.appendChild(appli);


    }
    main.appendChild(clone);
    accounts.add(key);
    console.log(testStr);
}

