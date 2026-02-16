const dinnerMenuData = JSON.parse(JSON.stringify(globalThis.menuOverviewData || {}));

if (dinnerMenuData['4'] && dinnerMenuData['4'].Friday) {
  dinnerMenuData['4'].Friday['Appetizer 1'] = 'Corn Chowder';
  dinnerMenuData['4'].Friday.Elevated = 'Crab Cakes';
  dinnerMenuData['4'].Friday.Traditional = 'Beef Pastrami Sandwich';
  dinnerMenuData['4'].Friday.Dessert = 'Chocolate Layer Cake';
}

globalThis.dinnerMenuData = dinnerMenuData;
