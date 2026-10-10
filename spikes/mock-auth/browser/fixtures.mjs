import { validateHttpResponse, validateJsonRequest } from '/work/testing/api/contracts/validator.ts';
export {validateJsonRequest};
export const item={id:'mock-wand',name:'Mock Wand of Embers',description:'Synthetic consumer fixture',rarity:'Rare',image:'/images/wand-embers.png',priceCopper:100,active:true};
export const profile={sub:'00000000-0000-4000-8000-000000000001',displayName:'Mock Adventurer',regionId:'waterdeep',location:[-120,45]};
export const order={orderId:'order-mock-1',ownerSub:profile.sub,regionId:'waterdeep',status:'completed',createdAt:'2026-10-09T00:00:00Z',completedAt:'2026-10-09T00:00:00Z',lines:[{itemId:item.id,name:item.name,unitPriceCopper:100,quantity:1,lineTotalCopper:100}],totalCopper:100};
export function checked(service,operation,status,body,headers={}){
  const responseHeaders={'content-type':'application/json',...headers};
  validateHttpResponse(service,operation,status,{status,headers:responseHeaders,rawBody:Buffer.from(JSON.stringify(body))});
  return {status,headers:responseHeaders,body:JSON.stringify(body)};
}
export function apiFixture(path,method,url,state,body){
  if(path==='/api/catalog/items')return checked('catalog','listItems',200,{items:[item],nextCursor:null});
  if(path===`/api/catalog/items/${item.id}`)return checked('catalog','getItem',200,item);
  if(path==='/api/customer/me')return checked('customer','getMyProfile',200,profile);
  if(path==='/api/customer/me/widgets'){
    if(method==='PUT'){validateJsonRequest('customer','putMyWidgets',body);state.widgetIds=body.widgetIds;}
    return checked('customer',method==='PUT'?'putMyWidgets':'getMyWidgets',200,{widgetIds:state.widgetIds});
  }
  if(path==='/api/customer/orders'){
    if(method==='POST'){validateJsonRequest('customer','createOrder',body);state.created++;return checked('customer','createOrder',201,order,{location:'/api/customer/orders/order-mock-1'});}
    return checked('customer','listMyOrders',200,{items:state.created?[order]:[],nextCursor:null});
  }
  if(path==='/api/customer/admin/users')return checked('customer','listAdminUsers',200,{items:[profile],nextCursor:null});
  if(path==='/api/customer/admin/orders')return checked('customer','listAdminOrders',200,{items:[],nextCursor:null});
  if(path==='/api/insights/regions')return checked('insights','listRegions',200,{type:'FeatureCollection',features:[{type:'Feature',properties:{regionId:'waterdeep',name:'Waterdeep',center:[-120,45]},geometry:{type:'Polygon',coordinates:[[[-121,44],[-119,44],[-119,46],[-121,46],[-121,44]]]}}]});
  if(path==='/api/insights/sales')return checked('insights','getSalesSummary',200,{from:url.searchParams.get('from'),to:url.searchParams.get('to'),status:'completed',orderCount:1,customerCount:1,salesCopper:100,regions:[{regionId:'waterdeep',orderCount:1,customerCount:1,salesCopper:100}]});
  if(path==='/api/insights/follow-ups')return checked('insights','listFollowUps',200,{items:[],nextCursor:null});
  throw new Error(`Unexpected mock API operation ${method} ${path}`);
}
