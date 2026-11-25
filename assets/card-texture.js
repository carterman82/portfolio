// Capture local card content once. Canvas then deforms one continuous image,
// avoiding seams and duplicated interactive DOM nodes in the live mesh.
export async function cardTexture(card) {
  await document.fonts.ready;
  const clone=card.cloneNode(true);
  const source=[card,...card.querySelectorAll('*')];
  const copies=[clone,...clone.querySelectorAll('*')];
  const images=[];
  source.forEach((element,i)=>{
    const style=getComputedStyle(element);
    for(const property of style)copies[i].style.setProperty(property,style.getPropertyValue(property));
    copies[i].removeAttribute('id');
    copies[i].style.transition='none';copies[i].style.animation='none';
    if(element.tagName==='IMG')images.push((async()=>{
      const response=await fetch(element.currentSrc||element.src);
      if(!response.ok)throw new Error('Card image unavailable');
      const blob=await response.blob();
      copies[i].src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
      copies[i].removeAttribute('srcset');copies[i].removeAttribute('loading');
      copies[i].style.transform='none';
    })());
  });
  await Promise.all(images);
  const width=card.offsetWidth,height=card.offsetHeight;
  Object.assign(clone.style,{position:'relative',left:'0px',top:'0px',margin:'0px',transform:'none',translate:'none',opacity:'1',visibility:'visible',boxShadow:'none',width:`${width}px`,height:`${height}px`});
  clone.setAttribute('xmlns','http://www.w3.org/1999/xhtml');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(clone)}</foreignObject></svg>`;
  const image=new Image();image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas=document.createElement('canvas');
  const scale=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);
  const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.drawImage(image,0,0,width,height);
  return {image:canvas,width,height};
}
