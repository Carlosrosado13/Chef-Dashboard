const lunchRecipesWeek1 = {
  "Week 1": {
    Monday: {
      soup: {
        title: "Roasted Tomato Basil Soup",
        yields: ["50", "100", "150"],
        ingredients: [
          { item: "Roma tomatoes, halved", qty50: "30 lb", qty100: "60 lb", qty150: "90 lb" },
          { item: "Yellow onions, diced", qty50: "6 lb", qty100: "12 lb", qty150: "18 lb" },
          { item: "Garlic, minced", qty50: "12 oz", qty100: "24 oz", qty150: "36 oz" },
          { item: "Olive oil", qty50: "1 qt", qty100: "2 qt", qty150: "3 qt" },
          { item: "Vegetable stock", qty50: "4 gal", qty100: "8 gal", qty150: "12 gal" },
          { item: "Fresh basil", qty50: "8 oz", qty100: "16 oz", qty150: "24 oz" },
          { item: "Salt and black pepper", qty50: "to taste", qty100: "to taste", qty150: "to taste" }
        ],
        instructions: "1) Roast tomatoes with onion, garlic, and olive oil at 400°F until caramelized.\n2) Transfer to stock pot, add vegetable stock, and simmer 30 minutes.\n3) Blend smooth and pass through chinois.\n4) Finish with chopped basil, season, and hold hot for service.",
        notes: "GF/DF"
      },
      salad: {
        title: "Arugula, Shaved Fennel & Citrus",
        yields: ["50", "100", "150"],
        ingredients: [
          { item: "Baby arugula", qty50: "8 lb", qty100: "16 lb", qty150: "24 lb" },
          { item: "Fennel bulbs, shaved", qty50: "12 each", qty100: "24 each", qty150: "36 each" },
          { item: "Orange supremes", qty50: "5 qt", qty100: "10 qt", qty150: "15 qt" },
          { item: "Grapefruit supremes", qty50: "3 qt", qty100: "6 qt", qty150: "9 qt" },
          { item: "Mint leaves", qty50: "2 cups", qty100: "4 cups", qty150: "6 cups" }
        ],
        instructions: "1) Keep all salad components chilled.\n2) Combine arugula, shaved fennel, and citrus segments in hotel pans.\n3) Dress lightly just before service and finish with mint leaves.",
        notes: "Serve with Citrus Vinaigrette sub-recipe."
      },
      saladDressing: {
        title: "Citrus Vinaigrette",
        yields: ["50", "100", "150"],
        ingredients: [
          { item: "Orange juice", qty50: "1 qt", qty100: "2 qt", qty150: "3 qt" },
          { item: "Lemon juice", qty50: "2 cups", qty100: "4 cups", qty150: "6 cups" },
          { item: "White wine vinegar", qty50: "2 cups", qty100: "4 cups", qty150: "6 cups" },
          { item: "Dijon mustard", qty50: "1 cup", qty100: "2 cups", qty150: "3 cups" },
          { item: "Honey", qty50: "1 cup", qty100: "2 cups", qty150: "3 cups" },
          { item: "Olive oil", qty50: "3 qt", qty100: "6 qt", qty150: "9 qt" },
          { item: "Salt and black pepper", qty50: "to taste", qty100: "to taste", qty150: "to taste" }
        ],
        instructions: "1) Whisk citrus juices, vinegar, Dijon, and honey.\n2) Stream in olive oil until emulsified.\n3) Season and chill below 40°F."
      },
      main1: {
        title: "Grilled Lemon-Herb Chicken",
        yields: ["50", "100", "150"],
        ingredients: [
          { item: "Chicken breast, 6 oz portions", qty50: "19 lb", qty100: "38 lb", qty150: "57 lb" },
          { item: "Olive oil", qty50: "1.5 qt", qty100: "3 qt", qty150: "4.5 qt" },
          { item: "Lemon juice", qty50: "2 qt", qty100: "4 qt", qty150: "6 qt" },
          { item: "Garlic, minced", qty50: "10 oz", qty100: "20 oz", qty150: "30 oz" },
          { item: "Parsley and oregano", qty50: "2 cups", qty100: "4 cups", qty150: "6 cups" },
          { item: "Salt and black pepper", qty50: "to taste", qty100: "to taste", qty150: "to taste" }
        ],
        instructions: "1) Marinate chicken with lemon, garlic, herbs, and oil for at least 2 hours.\n2) Grill to 165°F internal temperature.\n3) Rest 5 minutes and hold hot for service."
      },
      main2: {
        title: "Seared Salmon with Dill Yogurt",
        yields: ["50", "100", "150"],
        ingredients: [
          { item: "Salmon fillet, 5 oz portions", qty50: "16 lb", qty100: "32 lb", qty150: "48 lb" },
          { item: "Canola oil", qty50: "1 qt", qty100: "2 qt", qty150: "3 qt" },
          { item: "Greek yogurt", qty50: "3 qt", qty100: "6 qt", qty150: "9 qt" },
          { item: "Fresh dill, chopped", qty50: "1 cup", qty100: "2 cups", qty150: "3 cups" },
          { item: "Lemon zest and juice", qty50: "1 cup", qty100: "2 cups", qty150: "3 cups" },
          { item: "Salt and white pepper", qty50: "to taste", qty100: "to taste", qty150: "to taste" }
        ],
        instructions: "1) Season salmon and sear until just cooked.\n2) Mix yogurt, dill, lemon, salt, and pepper for sauce.\n3) Serve salmon with dill yogurt sauce on top."
      },
      dessert: {
        title: "Chocolate Pot de Crème",
        yields: ["50", "100", "150"],
        ingredients: [
          { item: "Heavy cream", qty50: "1.5 gal", qty100: "3 gal", qty150: "4.5 gal" },
          { item: "Whole milk", qty50: "1 gal", qty100: "2 gal", qty150: "3 gal" },
          { item: "Dark chocolate", qty50: "6 lb", qty100: "12 lb", qty150: "18 lb" },
          { item: "Egg yolks", qty50: "80", qty100: "160", qty150: "240" },
          { item: "Sugar", qty50: "5 lb", qty100: "10 lb", qty150: "15 lb" },
          { item: "Vanilla extract", qty50: "4 oz", qty100: "8 oz", qty150: "12 oz" }
        ],
        instructions: "1) Heat cream and milk until steaming.\n2) Temper yolks with sugar, then combine with cream and chocolate.\n3) Portion and bake in water bath at 300°F until set.\n4) Chill before service."
      }
    },
    Tuesday: {
      soup: { title: "Cream of Mushroom", yields: ["50", "100", "150"], ingredients: [{ item: "Mushrooms, sliced", qty50: "20 lb", qty100: "40 lb", qty150: "60 lb" }, { item: "Leeks, sliced", qty50: "6 lb", qty100: "12 lb", qty150: "18 lb" }, { item: "Butter", qty50: "3 lb", qty100: "6 lb", qty150: "9 lb" }, { item: "Flour", qty50: "2 lb", qty100: "4 lb", qty150: "6 lb" }, { item: "Vegetable stock", qty50: "4 gal", qty100: "8 gal", qty150: "12 gal" }, { item: "Cream", qty50: "2 gal", qty100: "4 gal", qty150: "6 gal" }], instructions: "1) Sweat leeks and mushrooms in butter.\n2) Add flour to make roux, then whisk in stock.\n3) Simmer, blend partially, and finish with cream.", notes: "GF option with starch slurry" },
      salad: { title: "Mixed Greens, Pear & Walnuts", yields: ["50", "100", "150"], ingredients: [{ item: "Mixed greens", qty50: "10 lb", qty100: "20 lb", qty150: "30 lb" }, { item: "Pear, sliced", qty50: "8 lb", qty100: "16 lb", qty150: "24 lb" }, { item: "Candied walnuts", qty50: "4 lb", qty100: "8 lb", qty150: "12 lb" }, { item: "Crumbled goat cheese", qty50: "3 lb", qty100: "6 lb", qty150: "9 lb" }], instructions: "1) Prepare pears just before service to prevent browning.\n2) Toss greens with vinaigrette.\n3) Top with pears, walnuts, and goat cheese.", notes: "Serve with white balsamic vinaigrette." },
      saladDressing: { title: "White Balsamic Vinaigrette", yields: ["50", "100", "150"], ingredients: [{ item: "White balsamic vinegar", qty50: "2 cups", qty100: "4 cups", qty150: "6 cups" }, { item: "Dijon mustard", qty50: "1 cup", qty100: "2 cups", qty150: "3 cups" }, { item: "Maple syrup", qty50: "1 cup", qty100: "2 cups", qty150: "3 cups" }, { item: "Olive oil", qty50: "3 qt", qty100: "6 qt", qty150: "9 qt" }], instructions: "1) Whisk vinegar, mustard, and maple syrup.\n2) Emulsify with olive oil and season." },
      main1: { title: "Beef Bourguignon", yields: ["50", "100", "150"], ingredients: [{ item: "Beef chuck, large dice", qty50: "45 lb", qty100: "90 lb", qty150: "135 lb" }, { item: "Red wine", qty50: "2 gal", qty100: "4 gal", qty150: "6 gal" }, { item: "Beef stock", qty50: "3 gal", qty100: "6 gal", qty150: "9 gal" }, { item: "Carrots", qty50: "8 lb", qty100: "16 lb", qty150: "24 lb" }, { item: "Pearl onions", qty50: "6 lb", qty100: "12 lb", qty150: "18 lb" }, { item: "Mushrooms", qty50: "10 lb", qty100: "20 lb", qty150: "30 lb" }], instructions: "1) Sear beef in batches.\n2) Add mirepoix, wine, and stock; braise until tender.\n3) Finish with mushrooms and pearl onions.", notes: "Serve hot; hold above 140°F." },
      main2: { title: "Ricotta Gnocchi", yields: ["50", "100", "150"], ingredients: [{ item: "Ricotta", qty50: "12 lb", qty100: "24 lb", qty150: "36 lb" }, { item: "Eggs", qty50: "20", qty100: "40", qty150: "60" }, { item: "Parmesan", qty50: "4 lb", qty100: "8 lb", qty150: "12 lb" }, { item: "Flour", qty50: "5 lb", qty100: "10 lb", qty150: "15 lb" }, { item: "Butter", qty50: "3 lb", qty100: "6 lb", qty150: "9 lb" }], instructions: "1) Mix ricotta dough ingredients gently.\n2) Portion gnocchi and blanch until they float.\n3) Finish in browned butter and parmesan." },
      dessert: { title: "Vanilla Bean Panna Cotta", yields: ["50", "100", "150"], ingredients: [{ item: "Heavy cream", qty50: "2 gal", qty100: "4 gal", qty150: "6 gal" }, { item: "Milk", qty50: "1 gal", qty100: "2 gal", qty150: "3 gal" }, { item: "Sugar", qty50: "5 lb", qty100: "10 lb", qty150: "15 lb" }, { item: "Vanilla bean", qty50: "10 each", qty100: "20 each", qty150: "30 each" }, { item: "Gelatin", qty50: "10 oz", qty100: "20 oz", qty150: "30 oz" }], instructions: "1) Warm dairy with sugar and vanilla bean.\n2) Dissolve bloomed gelatin into mixture.\n3) Portion and chill until set." }
    },
    Wednesday: {
      soup: { title: "Sweet Corn Chowder", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      salad: { title: "Cucumber with Dill Yogurt", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      main1: { title: "Salmon Cakes with Herb Aioli", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      main2: { title: "Veal Parmesan", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      dessert: { title: "Banana Cream Pie", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" }
    },
    Thursday: {
      soup: { title: "Roasted Red Pepper Soup", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      salad: { title: "Caesar Salad", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      main1: { title: "Beef Stroganoff", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      main2: { title: "Chicken Schnitzel", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      dessert: { title: "Caramel Apple Crisp", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" }
    },
    Friday: {
      soup: { title: "New England Clam Chowder", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      salad: { title: "Bibb Lettuce & Avocado", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      main1: { title: "Fish and Chips", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      main2: { title: "Roast Beef Dip", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      dessert: { title: "Strawberry Shortcake", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" }
    },
    Saturday: {
      soup: { title: "Garlic Potato Soup", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      salad: { title: "Spinach Strawberry Salad", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      main1: { title: "Chicken Quesadilla", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      main2: { title: "Pork Tenderloin with Dijon Pan Sauce", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      dessert: { title: "Blueberry Cheesecake", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" }
    },
    Sunday: {
      soup: { title: "Chicken Noodle Soup", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      salad: { title: "Tomato & Burrata", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      main1: { title: "Braised Beef with Mushroom Gravy", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      main2: { title: "Grilled Cheese & Tomato Soup", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" },
      dessert: { title: "Carrot Cake", yields: ["50", "100", "150"], ingredients: [], instructions: "Recipe not added yet" }
    }
  }
};

globalThis.lunchRecipesWeek1 = lunchRecipesWeek1;
