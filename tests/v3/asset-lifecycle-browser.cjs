process.env.V2_EVIDENCE_DIR||='docs/phase3-4/evidence';
process.env.V2_TEST_PORT||='4399';
const assert=require('node:assert/strict');
const {browserRun}=require('../v2/harness.cjs');

browserRun('asset-lifecycle',async({page,check,report,origin})=>{
  await page.goto(origin);await page.waitForFunction(()=>window.studio);
  await page.evaluate(()=>studio.go(4,{rackId:'rack-1',equipmentId:null}));

  await check('A post-acquire shader binding failure releases its sole GLB lease and restores the chassis',async()=>{
    const result=await page.evaluate(async()=>{
      const {attachL10}=await import('/modules/scene/l10-assets.js'),hit=studio.projection.item('editorial-compute-01');
      const before={refs:studio.library.refs,materials:studio.studio.materials.size,children:hit.item.mount.children.length},bind=studio.studio.bind;
      let count=0,error=null;
      studio.studio.bind=function(...args){if(++count===3)throw Error('TEST binding failure');return bind.apply(this,args);};
      try{await attachL10(studio.library,hit.rig,hit.item);}catch(e){error=e.message;}finally{studio.studio.bind=bind;}
      return{before,error,boundMeshes:count,refs:studio.library.refs,assetReleased:studio.library.asset===null,pending:studio.library.pending,materials:studio.studio.materials.size,children:hit.item.mount.children.length,detail:hit.item.details,fallbackVisible:hit.item.mesh.visible};
    });
    assert.equal(result.before.refs,0);assert.equal(result.error,'TEST binding failure');assert.equal(result.boundMeshes,3);
    assert.equal(result.refs,0);assert.equal(result.assetReleased,true);assert.equal(result.pending,null);
    assert.equal(result.materials,result.before.materials);assert.equal(result.children,result.before.children);assert.equal(result.detail,null);assert.equal(result.fallbackVisible,true);
    return result;
  });

  await check('A failing second attachment cannot dispose another equipment shared geometry or textures',async()=>{
    const result=await page.evaluate(async()=>{
      const {attachL10}=await import('/modules/scene/l10-assets.js'),first=studio.projection.item('editorial-compute-01'),second=studio.projection.item('editorial-compute-02');
      const baseline=studio.studio.materials.size,keeper=await attachL10(studio.library,first.rig,first.item),asset=studio.library.asset,bind=studio.studio.bind;
      const resources=new Set();asset.prototype.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material){resources.add(o.material);for(const u of Object.values(o.material.uniforms||{}))if(u.value?.isTexture&&u.value.userData.l10Owned)resources.add(u.value);}});
      let disposedDuringFailure=0,error=null;const onDispose=()=>disposedDuringFailure++;resources.forEach(r=>r.addEventListener('dispose',onDispose));
      studio.studio.bind=()=>{throw Error('TEST second attachment failure');};
      try{await attachL10(studio.library,second.rig,second.item);}catch(e){error=e.message;}finally{studio.studio.bind=bind;}
      const failed={error,refs:studio.library.refs,sameAsset:studio.library.asset===asset,keeperAttached:first.item.details===keeper&&keeper.group.parent===first.item.mount,secondDetail:second.item.details,fallbackVisible:second.item.mesh.visible,disposedDuringFailure};
      resources.forEach(r=>r.removeEventListener('dispose',onDispose));
      let retry;
      try{retry=await attachL10(studio.library,second.rig,second.item);failed.retryRefs=studio.library.refs;failed.retryEntity=retry.entityId;}
      finally{retry?.dispose();keeper.dispose();keeper.dispose();}
      return{...failed,releasedRefs:studio.library.refs,assetReleased:studio.library.asset===null,baseline,materials:studio.studio.materials.size};
    });
    assert.equal(result.error,'TEST second attachment failure');assert.equal(result.refs,1);assert.equal(result.sameAsset,true);assert.equal(result.keeperAttached,true);
    assert.equal(result.secondDetail,null);assert.equal(result.fallbackVisible,true);assert.equal(result.disposedDuringFailure,0);
    assert.equal(result.retryRefs,2);assert.equal(result.retryEntity,'editorial-compute-02');assert.equal(result.releasedRefs,0);assert.equal(result.assetReleased,true);assert.equal(result.materials,result.baseline);
    return result;
  });

  await check('An exception after mounting rolls back hierarchy and visibility; cancellation releases exactly one lease',async()=>{
    const result=await page.evaluate(async()=>{
      const {attachL10}=await import('/modules/scene/l10-assets.js'),first=studio.projection.item('editorial-compute-01'),second=studio.projection.item('editorial-compute-02');
      const keeper=await attachL10(studio.library,first.rig,first.item),before=second.item.mount.children.length,descriptor=Object.getOwnPropertyDescriptor(second.item.mesh,'visible');
      let visible=second.item.mesh.visible,injected=false,error=null;
      Object.defineProperty(second.item.mesh,'visible',{configurable:true,get:()=>visible,set:value=>{visible=value;if(value===false&&!injected){injected=true;throw Error('TEST mounted visibility failure');}}});
      try{await attachL10(studio.library,second.rig,second.item);}catch(e){error=e.message;}
      finally{Object.defineProperty(second.item.mesh,'visible',{...descriptor,value:visible});}
      const failed={error,injected,children:second.item.mount.children.length,before,visible:second.item.mesh.visible,detail:second.item.details,refs:studio.library.refs};
      const controller=new AbortController();controller.abort();let cancellation;
      try{await attachL10(studio.library,second.rig,second.item,{signal:controller.signal});}catch(e){cancellation=e.name;}
      const retainedRefs=studio.library.refs;keeper.dispose();
      return{...failed,cancellation,retainedRefs,releasedRefs:studio.library.refs,assetReleased:studio.library.asset===null};
    });
    assert.equal(result.error,'TEST mounted visibility failure');assert.equal(result.injected,true);assert.equal(result.children,result.before);assert.equal(result.visible,true);assert.equal(result.detail,null);assert.equal(result.refs,1);
    assert.equal(result.cancellation,'AbortError');assert.equal(result.retainedRefs,1);assert.equal(result.releasedRefs,0);assert.equal(result.assetReleased,true);
    return result;
  });

  await check('Normal Board navigation still loads and releases after injected failures without renderer errors',async()=>{
    await page.evaluate(()=>studio.go(6,{rackId:'rack-1',equipmentId:'editorial-compute-01'}));
    const detail=await page.evaluate(()=>({entity:studio.projection.item(studio.state.equipmentId).item.details?.entityId,refs:studio.library.refs}));
    assert.equal(detail.entity,'editorial-compute-01');assert.equal(detail.refs,1);
    await page.evaluate(()=>studio.go(3));assert.equal(await page.evaluate(()=>studio.library.refs),0);
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);
    return{...detail,releasedRefs:0};
  });
});
