(function () {
  const week2Recipes = {
    Monday: {
      soup: {
        title: 'Carrot Ginger Soup',
        yields: ['50', '100', '150'],
        ingredients: [],
        instructions: 'Instructions pending – not found in source document',
        notes: ''
      },
      salad: {
        title: 'Baby Kale, Quinoa & Pomegranate Salad',
        yields: ['50', '100', '150'],
        ingredients: [],
        instructions: 'Instructions pending – not found in source document',
        notes: ''
      },
      side: {
        title: 'Baby Kale, Quinoa & Pomegranate Salad',
        yields: ['50', '100', '150'],
        ingredients: [],
        instructions: 'Instructions pending – not found in source document',
        notes: ''
      },
      main1: {
        title: 'Grilled Swordfish with Caponata',
        yields: ['50', '100', '150'],
        ingredients: [],
        instructions: 'Instructions pending – not found in source document',
        notes: ''
      },
      main2: {
        title: 'Chicken Marsala',
        yields: ['50', '100', '150'],
        ingredients: [],
        instructions: 'Instructions pending – not found in source document',
        notes: ''
      },
      dessert: {
        title: 'Coconut Rice Pudding',
        yields: ['50', '100', '150'],
        ingredients: [],
        instructions: 'Instructions pending – not found in source document',
        notes: ''
      }
    },
    Tuesday: {
      soup: { title: 'French Onion Soup', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      salad: { title: 'Roasted Beet & Goat Cheese Salad', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      side: { title: 'Roasted Beet & Goat Cheese Salad', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      main1: { title: 'Lamb Meatballs with Yogurt Sauce', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      main2: { title: 'Spinach & Ricotta Cannelloni', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      dessert: { title: 'Chocolate Mousse', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' }
    },
    Wednesday: {
      soup: { title: 'Leek & Potato Soup', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      salad: { title: 'Shaved Brussels Sprouts & Parmesan Salad', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      side: { title: 'Shaved Brussels Sprouts & Parmesan Salad', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      main1: { title: 'Miso-Glazed Salmon', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      main2: { title: 'Pork Schnitzel', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      dessert: { title: 'Vanilla Poached Pears', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' }
    },
    Thursday: {
      soup: { title: 'Tomato Bisque', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      salad: { title: 'Mixed Greens with Champagne Vinaigrette', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      side: { title: 'Mixed Greens with Champagne Vinaigrette', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      main1: { title: 'Turkey Roulade', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      main2: { title: 'Eggplant Parmesan', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      dessert: { title: 'Lemon Tart', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' }
    },
    Friday: {
      soup: { title: 'Potato & Bacon Chowder', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      salad: { title: 'Classic Wedge Salad', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      side: { title: 'Classic Wedge Salad', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      main1: { title: 'Seared Scallops', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      main2: { title: 'Beef Stroganoff', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      dessert: { title: 'Cheesecake Bars', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' }
    },
    Saturday: {
      soup: { title: 'Roasted Cauliflower Soup', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      salad: { title: 'Arugula & Shaved Parmesan Salad', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      side: { title: 'Arugula & Shaved Parmesan Salad', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      main1: { title: 'Grilled Chicken Pesto', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      main2: { title: 'Mushroom Tagliatelle', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      dessert: { title: 'Berry Shortcake', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' }
    },
    Sunday: {
      soup: { title: 'Lentil & Herb Soup', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      salad: { title: 'Cabbage Slaw with Apple Cider Vinaigrette', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      side: { title: 'Cabbage Slaw with Apple Cider Vinaigrette', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      main1: { title: 'Braised Pork Shoulder', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      main2: { title: 'Stuffed Peppers', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' },
      dessert: { title: 'Bread Pudding with Vanilla Sauce', yields: ['50', '100', '150'], ingredients: [], instructions: 'Instructions pending – not found in source document', notes: '' }
    }
  };

  globalThis.lunchRecipesWeek1 = globalThis.lunchRecipesWeek1 || {};
  globalThis.lunchRecipesWeek1['Week 2'] = week2Recipes;
})();
