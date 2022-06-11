
const testStr= "1111";

async function restartAPP(appname, key){

  const resp = await fetch(`https://api.heroku.com/apps/${appname}/dynos`,{
                method: "Delete",
                headers: {
                    Accept: "application/vnd.heroku+json; version=3",
                    Authorization: `Bearer ${key}`
                }
            });

    if(resp.status === 202){
        alert("restart success!")
    }

}

export {
    testStr,
    restartAPP
}