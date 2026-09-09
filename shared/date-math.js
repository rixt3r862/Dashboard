(function () {
  const DAY=86400000;
  function weekdaysBetween(a,b,inclusive=false) {
    const start=new Date(Math.min(a.getTime(),b.getTime()));
    const end=new Date(Math.max(a.getTime(),b.getTime()));
    const days=Math.round((end-start)/DAY)+(inclusive?1:0);
    let result=Math.floor(days/7)*5;
    for(let i=0;i<days%7;i++){
      const weekday=(start.getUTCDay()+i)%7;
      if(weekday!==0 && weekday!==6)result++;
    }
    return result;
  }
  function shiftWeekdays(base,amount) {
    const date=new Date(base),sign=Math.sign(amount);
    let remaining=Math.abs(amount);
    while(remaining>0) {
      const day=date.getUTCDay();
      if(day!==0 && day!==6 && remaining>=5) {
        const weeks=Math.floor(remaining/5);
        date.setUTCDate(date.getUTCDate()+weeks*7*sign);remaining%=5;
      } else {
        date.setUTCDate(date.getUTCDate()+sign);
        if(date.getUTCDay()!==0 && date.getUTCDay()!==6)remaining--;
      }
    }
    return date;
  }
  window.DateMath={weekdaysBetween,shiftWeekdays};
})();
