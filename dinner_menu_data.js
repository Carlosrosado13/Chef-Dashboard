const dinnerMenuData = JSON.parse(JSON.stringify(globalThis.lunchMenuData || {}));

if (dinnerMenuData['Week 1'] && dinnerMenuData['Week 1'].Monday) {
  dinnerMenuData['Week 1'].Monday.SOUP = 'Roasted Tomato Basil';
  dinnerMenuData['Week 1'].Monday.SALAD = 'Arugula / Shaved Fennel / Citrus Vinaigrette';
  dinnerMenuData['Week 1'].Monday['MAIN 1'] = 'Grilled Lemon & Herb Chicken Breast';
  dinnerMenuData['Week 1'].Monday['MAIN 2'] = 'Seared Salmon / Dill Yogurt';
  dinnerMenuData['Week 1'].Monday.DESSERT = 'Chocolate Pot de Creme';
}

if (dinnerMenuData['Week 4'] && dinnerMenuData['Week 4'].Friday) {
  dinnerMenuData['Week 4'].Friday.SOUP = 'Corn Chowder';
  dinnerMenuData['Week 4'].Friday.SALAD = 'Bibb Lettuce / Radish';
  dinnerMenuData['Week 4'].Friday['MAIN 1'] = 'Crab Cakes';
  dinnerMenuData['Week 4'].Friday['MAIN 2'] = 'Beef Pastrami Sandwich';
  dinnerMenuData['Week 4'].Friday.DESSERT = 'Chocolate Layer Cake';
}

globalThis.dinnerMenuData = dinnerMenuData;
