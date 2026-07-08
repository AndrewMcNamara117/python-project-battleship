/* ============================================================
   IRON MILES — site-wide motion engine (injected, zero deps)
   char reveals · parallax · clip reveals · cursor · magnetic
   ============================================================ */
(function(){
"use strict";
var reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
var touch=matchMedia('(hover: none), (pointer: coarse)').matches;
if(reduced)return;
document.documentElement.classList.add('im-motion');
var lerp=function(a,b,t){return a+(b-a)*t;};
var clamp=function(v,a,b){return v<a?a:(v>b?b:v);};

/* ---- progress bar ---- */
var prog=document.createElement('div');prog.id='im-progress';prog.setAttribute('aria-hidden','true');
document.body.appendChild(prog);

/* ---- cursor ---- */
var cursor=null,mx=innerWidth/2,my=innerHeight/2,cx=mx,cy=my,rx=mx,ry=my;
if(!touch){
  cursor=document.createElement('div');cursor.id='im-cursor';cursor.setAttribute('aria-hidden','true');
  cursor.innerHTML='<div class="ring"></div><div class="dot"></div>';
  document.body.appendChild(cursor);
  addEventListener('mousemove',function(e){mx=e.clientX;my=e.clientY;},{passive:true});
  addEventListener('mousedown',function(){cursor.classList.add('press')});
  addEventListener('mouseup',function(){cursor.classList.remove('press')});
  document.querySelectorAll('a,button').forEach(function(el){
    el.addEventListener('mouseenter',function(){cursor.classList.add('hover')});
    el.addEventListener('mouseleave',function(){cursor.classList.remove('hover')});
  });
}

/* ---- magnetic buttons ---- */
var magnets=[];
if(!touch){
  document.querySelectorAll('.btn').forEach(function(el){
    var st={el:el,tx:0,ty:0,x:0,y:0};
    el.addEventListener('mousemove',function(e){
      var r=el.getBoundingClientRect();
      st.tx=(e.clientX-r.left-r.width/2)*.26;st.ty=(e.clientY-r.top-r.height/2)*.32;
    });
    el.addEventListener('mouseleave',function(){st.tx=0;st.ty=0;});
    magnets.push(st);
  });
}

/* ---- char splitting ---- */
function split(el){
  function walk(node){
    Array.prototype.slice.call(node.childNodes).forEach(function(ch){
      if(ch.nodeType===3){
        var frag=document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach(function(tok){
          if(!tok)return;
          if(/^\s+$/.test(tok)){frag.appendChild(document.createTextNode(' '));return;}
          var w=document.createElement('span');w.className='im-chw';
          tok.split('').forEach(function(c){
            var s=document.createElement('span');s.className='im-ch';s.textContent=c;w.appendChild(s);
          });
          frag.appendChild(w);
        });
        node.replaceChild(frag,ch);
      } else if(ch.nodeType===1&&ch.tagName!=='BR') walk(ch);
    });
  }
  walk(el);el.classList.add('im-split');
}
function play(el){
  if(el.classList.contains('im-in'))return;
  el.querySelectorAll('.im-ch').forEach(function(s,i){s.style.transitionDelay=(i*30)+'ms';});
  el.classList.add('im-in');
}
var splitTargets=document.querySelectorAll('.hero h1,.section-head h2,.banner blockquote,main .legal h1');
splitTargets.forEach(function(el){ if(el.textContent.trim().length<90) split(el); });

/* ---- observers: splits, clip reveals, counters, fact cells ---- */
var clips=document.querySelectorAll('.feature .media,.grid figure,.tl .media,.pgrid figure');
clips.forEach(function(el){el.classList.add('im-clip')});
var io=new IntersectionObserver(function(es){
  es.forEach(function(e){
    if(!e.isIntersecting)return;
    var el=e.target;
    if(el.classList.contains('im-split'))play(el);
    else el.classList.add('im-in');
    if(el.classList.contains('cell')){
      var num=el.querySelector('.num');
      if(num&&!num._imDone){num._imDone=true;counter(num);}
    }
    io.unobserve(el);
  });
},{threshold:.15,rootMargin:'0px 0px -5% 0px'});
splitTargets.forEach(function(el){io.observe(el)});
clips.forEach(function(el){io.observe(el)});
document.querySelectorAll('.facts .cell').forEach(function(el){io.observe(el)});

function counter(el){
  var txt=el.textContent,m=txt.match(/^([^0-9]*)(\d+)(.*)$/);
  if(!m)return;
  var target=parseInt(m[2],10);if(!target)return;
  var t0=null,dur=1300;
  function frame(t){
    if(!t0)t0=t;
    var p=clamp((t-t0)/dur,0,1);p=1-Math.pow(1-p,4);
    el.textContent=m[1]+Math.round(target*p)+m[3];
    if(p<1)requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---- scroll FX: progress + parallax ---- */
var heroBg=document.querySelector('.hero img.bg');
var banners=Array.prototype.slice.call(document.querySelectorAll('.banner>img'));
var scheduled=false;
function fx(){
  var y=scrollY,max=document.documentElement.scrollHeight-innerHeight;
  prog.style.transform='scaleX('+(max>0?y/max:0)+')';
  if(heroBg){
    var h=heroBg.parentElement.offsetHeight||innerHeight;
    if(y<h*1.2) heroBg.style.transform='scale(1.12) translateY('+(y*.18)+'px)';
  }
  banners.forEach(function(img){
    var r=img.parentElement.getBoundingClientRect();
    if(r.bottom<-60||r.top>innerHeight+60)return;
    var p=(r.top+r.height/2-innerHeight/2)/innerHeight;
    img.style.transform='scale(1.12) translateY('+(p*-38)+'px)';
  });
}
addEventListener('scroll',function(){
  if(scheduled)return;scheduled=true;
  requestAnimationFrame(function(){scheduled=false;fx();});
},{passive:true});
fx();

/* ---- rAF loop: cursor + magnets ---- */
if(!touch){
  (function loop(){
    cx=lerp(cx,mx,.6);cy=lerp(cy,my,.6);
    rx=lerp(rx,mx,.16);ry=lerp(ry,my,.16);
    if(cursor){
      cursor.children[1].style.transform='translate('+cx+'px,'+cy+'px)';
      cursor.children[0].style.transform='translate('+rx+'px,'+ry+'px)';
    }
    magnets.forEach(function(st){
      st.x=lerp(st.x,st.tx,.18);st.y=lerp(st.y,st.ty,.18);
      st.el.style.transform=(Math.abs(st.x)>.05||Math.abs(st.y)>.05)?'translate('+st.x+'px,'+st.y+'px)':'';
    });
    requestAnimationFrame(loop);
  })();
}
})();
