import {coverageResult} from './coverage.mjs';
const form=document.getElementById('coverage-form');
const output=document.getElementById('coverage-response');
if(form&&output){form.addEventListener('submit',event=>{
 event.preventDefault();
 const select=form.elements.namedItem('region');
 const result=coverageResult(select?.value);
 output.textContent=result.message;
 output.dataset.state=result.state;
});}
