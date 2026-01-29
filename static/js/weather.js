import {openDB} from 'https://unpkg.com/idb?module';
async function store_db(){
    
    let data=null;
    let db 
    db=await openDB("weather-DB",1,{
            upgrade(db){ //テーブルを作成
                if(!db.objectStoreNames.contains("forecast")){
                    db.createObjectStore("forecast");
                }
                
            }
        });
    try{//オンラインならfetch()して情報を取得、indexedDBに保存する
        const response=await fetch('/weather/api/weather');
        if(!response.ok){ 
            //500でもfetchは成功判定する(500:サーバーと通信できたが、内部でエラーが発生した。)
            //fetchが失敗するのはHTTPレスポンスそのものが返ってこない場合
            //500はレスポンスは返って来るものの内容がNGであるため、fetchは成功判定する
            throw new Error(`HTTP ${response.status}`)
        }
        data=await response.json();
       
        await db.put(
            'forecast',
            data,
            'latest'
        );
    }catch(error){ //オフラインならindexedDBに保存されているデータを使用する
        console.log(error);
        const cached=await db.get('forecast','latest');
        if (cached){
            data=cached;
        }else{
            document.textContent="データがありません";
            return;
        }
    }
    render(data);
}
function render(data){
    document.getElementById('summary').textContent=data.summary.text;
    document.getElementById('fetched_time').textContent=show(data.amedas.fetched_time);
    document.getElementById('temp').textContent=show(data.amedas.temp,"℃");
    document.getElementById('humidity').textContent=show(data.amedas.humidity,"%");
    document.getElementById('precip10m').textContent=show(data.amedas.precip10m,"mm");
    document.getElementById('precip1h').textContent=show(data.amedas.precip1h,"mm");
    document.getElementById('wind').textContent=show(data.amedas.wind,"m/s");

    let di_Element = document.getElementById('di_Element');
    di_Element.textContent=show(data.amedas.di);
    let di=Number(di_Element.textContent);
    let span = document.getElementById('di_text');
    span.textContent=data.amedas.di_text;
    span.className='di '+diLevel(di);

    document.getElementById('apparent_temp').textContent=show(data.amedas.apparent_temp,"℃");
    document.getElementById('advice').textContent=data.amedas.advice;
    
    document.getElementById('today').textContent=data.today.text;
    document.getElementById('today_ascii').textContent=data.today.ascii;
    let icon=data.today.icon;
    let today_icon=document.getElementById("weather_today");
    today_icon.className='weather '+icon;

    document.getElementById('today_max').textContent=show(data.today.max,"℃");
    /*今日の降水確率を取り出す*/
    const today_precip=document.getElementById('today_precip');
    const ul=today_precip.querySelector('ul');
    ul.innerHTML=""; //初期化
    const today_precip_list=data.precip_chances.today;
    // today_precip_list=["{ chance: "20", time: "12:00" },{ chance: "20", time: "18:00" }"]
    for(const item of today_precip_list){ 
        ul.innerHTML+=`
    <li>${item.time}: ${show(item.chance,"%")}</li>
    `
    }

    document.getElementById('tomorrow_ascii').textContent=data.tomorrow.ascii;
    icon=data.tomorrow.icon;
    let tomorrow_icon=document.getElementById("weather_tomorrow");
    tomorrow_icon.className='weather '+icon;
    document.getElementById('tomorrow').textContent=data.tomorrow.text;
    document.getElementById('tomorrow_max').textContent=show(data.tomorrow.max,"℃");
    document.getElementById('tomorrow_min').textContent=show(data.tomorrow.min,"℃");
    /*明日の降水確率を取り出す*/
    const tomorrow_precip=document.getElementById('tomorrow_precip');
    const tomorrow_ul=tomorrow_precip.querySelector('ul');
    tomorrow_ul.innerHTML="";
    const tomorrow_precip_list=data.precip_chances.tomorrow;
    for(const item of tomorrow_precip_list){
        tomorrow_ul.innerHTML+=`
        <li>${item.time}: ${show(item.chance,"%")}</li>
        `
    }

    /*週間天気予報*/
    const week=data.weekly_forecast; 
    /*{
    "date": "2月1日",
    "reliability": "B",
    "temp_max": "9",
    "temp_min": "4",
    "weather": "曇り",
    "weekly_pop": "40"
    }*/
    week.forEach((value,index) => {
        let reliability=value.reliability;
        let text=value.weather;
        document.querySelectorAll('.date')[index].textContent=value.date;
        document.querySelectorAll('.reliability')[index].textContent="信頼度: "+value.reliability;
        document.querySelectorAll('.weather-text')[index].textContent=eval_reliability(reliability,text);
        document.querySelectorAll('.max')[index].textContent="最高気温: "+show(value.temp_max,"℃");
        document.querySelectorAll('.min')[index].textContent="最低気温: "+show(value.temp_min,"℃");
        document.querySelectorAll('.pop')[index].textContent="降水確率: "+show(value.weekly_pop,"%");
    });
    
    


}
function diLevel(di){
    
    if(di<60){
        return 'cold';
    }else if(di<75){
        return 'comfortable'
    }else if(di<85){
        return 'hot'
    }else{
        return 'hottest'
    }
}
function show(value,unit=""){
    return value!==null && value !==undefined
    ? value+unit
    : "欠測" 
}
function eval_reliability(reliability,text){
    if(reliability==='A'){
        text+="!";
    }else if(reliability==='C'){
        text+="?"
    }
    return text;
}
store_db();