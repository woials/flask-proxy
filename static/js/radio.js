const output=document.getElementById('output');
output.textContent='';
const es=new EventSource('/radio/api/stream');
    es.onmessage=(event)=>{
        output.textContent+=event.data+"\n"
    };
    es.addEventListener('end',()=>{
        es.close();
    });
    es.onerror=(err)=>{
        console.error("EventSource failed:",err);
        es.close();
    }
     
const update=document.getElementById("updateButton");
update.onclick=async()=>{
    update.disabled=true;
    update.textContent="更新中...";

    try{
        const response=await fetch('/radio/web/radio/update',{
        method:'POST',
        });
    if(!response.ok){
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data=await response.json();
    console.log(data.status);
    update.textContent="更新要求を送信しました";
    }catch(error){
        console.error("送信エラー:",error);
        update.textContent="エラーが発生しました";
        update.disabled=false;
    }
};