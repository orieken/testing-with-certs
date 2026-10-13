export const ownerA='10101010-1010-4010-8010-101010101010';
export const ownerB='20202020-2020-4020-8020-202020202020';
export const from='2026-11-01T00:00:00Z',to='2026-12-01T00:00:00Z';
function row(id,ownerSub,completedAt,totalCopper,status='completed'){
 return {orderId:`region10-${id}`,ownerSub,regionId:'waterdeep',status,createdAt:completedAt??'2026-11-15T00:00:00Z',completedAt,lines:[{itemId:'potion-healing',name:'Boundary potion',unitPriceCopper:totalCopper,quantity:1,lineTotalCopper:totalCopper}],totalCopper};
}
export const fixtures=[row('lower-before',ownerA,'2026-10-31T23:59:59.999Z',400),row('lower-at',ownerA,from,100),row('upper-before',ownerB,'2026-11-30T23:59:59.999Z',200),row('upper-at',ownerB,to,300),row('pending',ownerA,null,90000,'pending'),row('cancelled',ownerB,null,80000,'cancelled'),...Array.from({length:108},(_,i)=>row(`middle-${String(i).padStart(3,'0')}`,i%2?ownerB:ownerA,'2026-11-15T12:00:00Z',100))];
// Independent hand-written arithmetic oracle: 108*100 + 100 + 200, 55 orders each owner.
export const oracle={orderCount:110,customerCount:2,salesCopper:11100,customerA:{orderCount:55,salesCopper:5500},customerB:{orderCount:55,salesCopper:5600}};
export const includedIds=['region10-lower-at','region10-upper-before',...Array.from({length:108},(_,i)=>`region10-middle-${String(i).padStart(3,'0')}`)].sort();
