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
     
