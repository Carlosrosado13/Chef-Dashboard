(function () {
  const catalog = {
    'Carrot Ginger Soup': {
      ingredients: [
        { item: 'Carrots, peeled and sliced', qty50: '28 lb', qty100: '56 lb', qty150: '84 lb' },
        { item: 'Yellow onions, diced', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Fresh ginger, minced', qty50: '2.5 lb', qty100: '5 lb', qty150: '7.5 lb' },
        { item: 'Garlic, minced', qty50: '12 oz', qty100: '24 oz', qty150: '36 oz' },
        { item: 'Vegetable stock', qty50: '5 gal', qty100: '10 gal', qty150: '15 gal' },
        { item: 'Coconut milk', qty50: '1.5 gal', qty100: '3 gal', qty150: '4.5 gal' },
        { item: 'Olive oil', qty50: '1 qt', qty100: '2 qt', qty150: '3 qt' },
        { item: 'Salt and white pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Sweat onions, ginger, and garlic in olive oil until aromatic.\n2) Add carrots and stock; simmer until carrots are fully tender.\n3) Blend smooth, return to kettle, and whisk in coconut milk.\n4) Season and hold hot above 140°F for service.',
      notes: 'GF/DF'
    },
    'Baby Kale, Quinoa & Pomegranate Salad': {
      ingredients: [
        { item: 'Baby kale', qty50: '10 lb', qty100: '20 lb', qty150: '30 lb' },
        { item: 'Quinoa, dry', qty50: '6 lb', qty100: '12 lb', qty150: '18 lb' },
        { item: 'Pomegranate arils', qty50: '4 qt', qty100: '8 qt', qty150: '12 qt' },
        { item: 'Cucumber, diced', qty50: '6 lb', qty100: '12 lb', qty150: '18 lb' },
        { item: 'Red onion, shaved', qty50: '2.5 lb', qty100: '5 lb', qty150: '7.5 lb' },
        { item: 'Lemon vinaigrette', qty50: '2 qt', qty100: '4 qt', qty150: '6 qt' },
        { item: 'Salt and black pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Rinse and cook quinoa; cool completely on sheet pans.\n2) Combine kale, quinoa, cucumber, onion, and pomegranate in chilled hotel pans.\n3) Toss with lemon vinaigrette just before service.\n4) Adjust seasoning and keep salad under refrigeration.',
      notes: 'GF/V'
    },
    'Grilled Swordfish with Caponata': {
      ingredients: [
        { item: 'Swordfish steaks, 6 oz portions', qty50: '19 lb', qty100: '38 lb', qty150: '57 lb' },
        { item: 'Olive oil', qty50: '1 qt', qty100: '2 qt', qty150: '3 qt' },
        { item: 'Eggplant, diced', qty50: '12 lb', qty100: '24 lb', qty150: '36 lb' },
        { item: 'Crushed tomatoes', qty50: '1.5 gal', qty100: '3 gal', qty150: '4.5 gal' },
        { item: 'Celery and onion, diced', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Capers and green olives', qty50: '4 lb', qty100: '8 lb', qty150: '12 lb' },
        { item: 'Red wine vinegar', qty50: '2 cups', qty100: '4 cups', qty150: '6 cups' },
        { item: 'Salt and black pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Roast eggplant until lightly caramelized.\n2) Build caponata with onion, celery, tomato, olives, capers, and vinegar; simmer 25 minutes.\n3) Season and grill swordfish to 145°F internal.\n4) Plate swordfish with warm caponata.',
      notes: 'GF/DF'
    },
    'Chicken Marsala': {
      ingredients: [
        { item: 'Chicken breast, 6 oz portions', qty50: '19 lb', qty100: '38 lb', qty150: '57 lb' },
        { item: 'Mushrooms, sliced', qty50: '12 lb', qty100: '24 lb', qty150: '36 lb' },
        { item: 'Marsala wine', qty50: '2 qt', qty100: '4 qt', qty150: '6 qt' },
        { item: 'Chicken stock', qty50: '2.5 gal', qty100: '5 gal', qty150: '7.5 gal' },
        { item: 'Butter', qty50: '4 lb', qty100: '8 lb', qty150: '12 lb' },
        { item: 'Flour for dredge', qty50: '3 lb', qty100: '6 lb', qty150: '9 lb' },
        { item: 'Parsley, chopped', qty50: '2 cups', qty100: '4 cups', qty150: '6 cups' },
        { item: 'Salt and pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Season and lightly dredge chicken; sear until golden.\n2) Sauté mushrooms, deglaze with Marsala, and reduce by half.\n3) Add stock and butter to finish sauce; return chicken and simmer to 165°F.\n4) Garnish with parsley and hold hot.',
      notes: ''
    },
    'Coconut Rice Pudding': {
      ingredients: [
        { item: 'Arborio rice', qty50: '6 lb', qty100: '12 lb', qty150: '18 lb' },
        { item: 'Coconut milk', qty50: '3 gal', qty100: '6 gal', qty150: '9 gal' },
        { item: 'Whole milk', qty50: '2 gal', qty100: '4 gal', qty150: '6 gal' },
        { item: 'Sugar', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Vanilla extract', qty50: '6 oz', qty100: '12 oz', qty150: '18 oz' },
        { item: 'Ground cinnamon', qty50: '1/3 cup', qty100: '2/3 cup', qty150: '1 cup' },
        { item: 'Toasted coconut flakes', qty50: '3 qt', qty100: '6 qt', qty150: '9 qt' }
      ],
      instructions: '1) Bring coconut milk and milk to a simmer; add rice and cook slowly until tender.\n2) Stir in sugar, vanilla, and cinnamon until fully dissolved.\n3) Chill in shallow pans and portion for service.\n4) Finish with toasted coconut flakes.',
      notes: 'GF'
    },
    'French Onion Soup': {
      ingredients: [
        { item: 'Yellow onions, thinly sliced', qty50: '40 lb', qty100: '80 lb', qty150: '120 lb' },
        { item: 'Butter', qty50: '5 lb', qty100: '10 lb', qty150: '15 lb' },
        { item: 'Beef stock', qty50: '5 gal', qty100: '10 gal', qty150: '15 gal' },
        { item: 'Dry white wine', qty50: '1.5 qt', qty100: '3 qt', qty150: '4.5 qt' },
        { item: 'Fresh thyme', qty50: '10 oz', qty100: '20 oz', qty150: '30 oz' },
        { item: 'Baguette slices', qty50: '60 ea', qty100: '120 ea', qty150: '180 ea' },
        { item: 'Gruyere cheese, shredded', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' }
      ],
      instructions: '1) Caramelize onions in butter over medium-low heat until deep golden.\n2) Deglaze with wine, add stock and thyme, and simmer 45 minutes.\n3) Toast baguette slices, top with Gruyere, and broil until melted.\n4) Serve soup with cheese crostini.',
      notes: ''
    },
    'Roasted Beet & Goat Cheese Salad': {
      ingredients: [
        { item: 'Beets, roasted and cut', qty50: '20 lb', qty100: '40 lb', qty150: '60 lb' },
        { item: 'Mixed greens', qty50: '9 lb', qty100: '18 lb', qty150: '27 lb' },
        { item: 'Goat cheese, crumbled', qty50: '5 lb', qty100: '10 lb', qty150: '15 lb' },
        { item: 'Candied walnuts', qty50: '4 lb', qty100: '8 lb', qty150: '12 lb' },
        { item: 'Orange segments', qty50: '4 qt', qty100: '8 qt', qty150: '12 qt' },
        { item: 'Balsamic vinaigrette', qty50: '2 qt', qty100: '4 qt', qty150: '6 qt' },
        { item: 'Salt and pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Roast beets until tender and cool before peeling.\n2) Build salad with greens, beets, oranges, goat cheese, and walnuts.\n3) Toss lightly with balsamic vinaigrette before service.\n4) Hold cold below 40°F.',
      notes: 'GF/V'
    },
    'Lamb Meatballs with Yogurt Sauce': {
      ingredients: [
        { item: 'Ground lamb', qty50: '24 lb', qty100: '48 lb', qty150: '72 lb' },
        { item: 'Breadcrumbs', qty50: '4 lb', qty100: '8 lb', qty150: '12 lb' },
        { item: 'Eggs', qty50: '24', qty100: '48', qty150: '72' },
        { item: 'Onion, minced', qty50: '4 lb', qty100: '8 lb', qty150: '12 lb' },
        { item: 'Garlic and cumin', qty50: '12 oz', qty100: '24 oz', qty150: '36 oz' },
        { item: 'Greek yogurt', qty50: '1.5 gal', qty100: '3 gal', qty150: '4.5 gal' },
        { item: 'Lemon juice and dill', qty50: '2 cups', qty100: '4 cups', qty150: '6 cups' },
        { item: 'Salt and pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Mix lamb, breadcrumbs, eggs, onion, garlic, and cumin; portion meatballs.\n2) Roast meatballs at 400°F until 160°F internal temperature.\n3) Whisk yogurt, lemon juice, dill, salt, and pepper for sauce.\n4) Serve meatballs with chilled yogurt sauce.',
      notes: ''
    },
    'Spinach & Ricotta Cannelloni': {
      ingredients: [
        { item: 'Cannelloni pasta tubes', qty50: '350 ea', qty100: '700 ea', qty150: '1050 ea' },
        { item: 'Ricotta cheese', qty50: '20 lb', qty100: '40 lb', qty150: '60 lb' },
        { item: 'Spinach, chopped', qty50: '12 lb', qty100: '24 lb', qty150: '36 lb' },
        { item: 'Mozzarella, shredded', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Parmesan, grated', qty50: '4 lb', qty100: '8 lb', qty150: '12 lb' },
        { item: 'Marinara sauce', qty50: '4 gal', qty100: '8 gal', qty150: '12 gal' },
        { item: 'Nutmeg, salt, and pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Blanch spinach, squeeze dry, and fold into ricotta with parmesan and seasoning.\n2) Fill cannelloni and arrange in hotel pans with marinara.\n3) Top with mozzarella and bake covered, then uncover to brown.\n4) Hold hot for service.',
      notes: 'Vegetarian'
    },
    'Chocolate Mousse': {
      ingredients: [
        { item: 'Dark chocolate', qty50: '7 lb', qty100: '14 lb', qty150: '21 lb' },
        { item: 'Heavy cream', qty50: '2.5 gal', qty100: '5 gal', qty150: '7.5 gal' },
        { item: 'Egg yolks', qty50: '70', qty100: '140', qty150: '210' },
        { item: 'Sugar', qty50: '5 lb', qty100: '10 lb', qty150: '15 lb' },
        { item: 'Vanilla extract', qty50: '4 oz', qty100: '8 oz', qty150: '12 oz' },
        { item: 'Sea salt', qty50: '2 tbsp', qty100: '4 tbsp', qty150: '6 tbsp' }
      ],
      instructions: '1) Melt chocolate gently over bain-marie.\n2) Whip cream to soft peaks and reserve chilled.\n3) Prepare pate a bombe with yolks and hot sugar syrup, then fold into chocolate.\n4) Fold whipped cream in batches, portion, and chill until set.',
      notes: 'Contains egg'
    },
    'Leek & Potato Soup': {
      ingredients: [
        { item: 'Leeks, sliced', qty50: '16 lb', qty100: '32 lb', qty150: '48 lb' },
        { item: 'Yukon potatoes, diced', qty50: '24 lb', qty100: '48 lb', qty150: '72 lb' },
        { item: 'Butter', qty50: '4 lb', qty100: '8 lb', qty150: '12 lb' },
        { item: 'Vegetable stock', qty50: '5 gal', qty100: '10 gal', qty150: '15 gal' },
        { item: 'Heavy cream', qty50: '1.5 gal', qty100: '3 gal', qty150: '4.5 gal' },
        { item: 'Thyme, bay, salt, pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Sweat leeks in butter without color.\n2) Add potatoes and stock; simmer until potatoes are very soft.\n3) Blend, return to kettle, and finish with cream.\n4) Adjust seasoning and hold hot.',
      notes: 'GF'
    },
    'Shaved Brussels Sprouts & Parmesan Salad': {
      ingredients: [
        { item: 'Brussels sprouts, shaved', qty50: '18 lb', qty100: '36 lb', qty150: '54 lb' },
        { item: 'Parmesan, shaved', qty50: '5 lb', qty100: '10 lb', qty150: '15 lb' },
        { item: 'Lemon juice', qty50: '2 cups', qty100: '4 cups', qty150: '6 cups' },
        { item: 'Extra virgin olive oil', qty50: '2 qt', qty100: '4 qt', qty150: '6 qt' },
        { item: 'Toasted almonds', qty50: '4 lb', qty100: '8 lb', qty150: '12 lb' },
        { item: 'Salt and cracked pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Shave sprouts thinly and keep chilled.\n2) Whisk lemon juice and olive oil for dressing.\n3) Toss sprouts with dressing, parmesan, and almonds just before service.\n4) Season and serve cold.',
      notes: 'GF'
    },
    'Miso-Glazed Salmon': {
      ingredients: [
        { item: 'Salmon fillets, 5 oz portions', qty50: '16 lb', qty100: '32 lb', qty150: '48 lb' },
        { item: 'White miso', qty50: '3 lb', qty100: '6 lb', qty150: '9 lb' },
        { item: 'Mirin', qty50: '1 qt', qty100: '2 qt', qty150: '3 qt' },
        { item: 'Soy sauce', qty50: '1 qt', qty100: '2 qt', qty150: '3 qt' },
        { item: 'Brown sugar', qty50: '3 lb', qty100: '6 lb', qty150: '9 lb' },
        { item: 'Sesame oil', qty50: '2 cups', qty100: '4 cups', qty150: '6 cups' },
        { item: 'Scallions and sesame seeds', qty50: '2 cups', qty100: '4 cups', qty150: '6 cups' }
      ],
      instructions: '1) Combine miso, mirin, soy, sugar, and sesame oil to make glaze.\n2) Marinate salmon at least 1 hour under refrigeration.\n3) Roast or broil salmon to 145°F internal, basting with glaze.\n4) Garnish with scallions and sesame seeds for service.',
      notes: 'DF'
    },
    'Pork Schnitzel': {
      ingredients: [
        { item: 'Pork loin cutlets, pounded thin', qty50: '22 lb', qty100: '44 lb', qty150: '66 lb' },
        { item: 'Flour', qty50: '4 lb', qty100: '8 lb', qty150: '12 lb' },
        { item: 'Eggs', qty50: '36', qty100: '72', qty150: '108' },
        { item: 'Breadcrumbs', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Clarified butter or oil', qty50: '2 gal', qty100: '4 gal', qty150: '6 gal' },
        { item: 'Lemon wedges', qty50: '60 ea', qty100: '120 ea', qty150: '180 ea' },
        { item: 'Salt and pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Bread pork cutlets in flour, egg wash, and breadcrumbs.\n2) Pan-fry in clarified butter until golden and crisp.\n3) Finish in oven as needed to 145°F internal.\n4) Serve with lemon wedges.',
      notes: ''
    },
    'Vanilla Poached Pears': {
      ingredients: [
        { item: 'Bosc pears, peeled', qty50: '55 ea', qty100: '110 ea', qty150: '165 ea' },
        { item: 'Water', qty50: '4 gal', qty100: '8 gal', qty150: '12 gal' },
        { item: 'Sugar', qty50: '12 lb', qty100: '24 lb', qty150: '36 lb' },
        { item: 'Vanilla beans', qty50: '10 ea', qty100: '20 ea', qty150: '30 ea' },
        { item: 'Lemon zest', qty50: '1 cup', qty100: '2 cups', qty150: '3 cups' },
        { item: 'Cinnamon sticks', qty50: '20 ea', qty100: '40 ea', qty150: '60 ea' }
      ],
      instructions: '1) Build poaching syrup with water, sugar, vanilla, zest, and cinnamon.\n2) Add pears and poach gently until tender but intact.\n3) Cool pears in syrup to absorb flavor.\n4) Hold chilled and portion with reduced syrup.',
      notes: 'GF/V'
    },
    'Tomato Bisque': {
      ingredients: [
        { item: 'Crushed tomatoes', qty50: '5 gal', qty100: '10 gal', qty150: '15 gal' },
        { item: 'Onions, diced', qty50: '10 lb', qty100: '20 lb', qty150: '30 lb' },
        { item: 'Garlic, minced', qty50: '14 oz', qty100: '28 oz', qty150: '42 oz' },
        { item: 'Vegetable stock', qty50: '3 gal', qty100: '6 gal', qty150: '9 gal' },
        { item: 'Heavy cream', qty50: '1.5 gal', qty100: '3 gal', qty150: '4.5 gal' },
        { item: 'Butter', qty50: '3 lb', qty100: '6 lb', qty150: '9 lb' },
        { item: 'Basil, salt, pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Sweat onion and garlic in butter.\n2) Add tomatoes and stock; simmer 30 minutes.\n3) Blend smooth and finish with cream.\n4) Season with basil, salt, and pepper before service.',
      notes: 'GF'
    },
    'Mixed Greens with Champagne Vinaigrette': {
      ingredients: [
        { item: 'Mixed baby greens', qty50: '9 lb', qty100: '18 lb', qty150: '27 lb' },
        { item: 'Cucumber, sliced', qty50: '5 lb', qty100: '10 lb', qty150: '15 lb' },
        { item: 'Cherry tomatoes, halved', qty50: '10 lb', qty100: '20 lb', qty150: '30 lb' },
        { item: 'Champagne vinegar', qty50: '2 cups', qty100: '4 cups', qty150: '6 cups' },
        { item: 'Dijon mustard', qty50: '1 cup', qty100: '2 cups', qty150: '3 cups' },
        { item: 'Olive oil', qty50: '3 qt', qty100: '6 qt', qty150: '9 qt' },
        { item: 'Honey, salt, pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Wash and dry greens thoroughly.\n2) Emulsify champagne vinegar, Dijon, honey, and olive oil.\n3) Combine greens with cucumber and tomatoes.\n4) Dress lightly right before service.',
      notes: 'GF/V'
    },
    'Turkey Roulade': {
      ingredients: [
        { item: 'Turkey breast, butterflied', qty50: '24 lb', qty100: '48 lb', qty150: '72 lb' },
        { item: 'Spinach', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Herb stuffing', qty50: '10 lb', qty100: '20 lb', qty150: '30 lb' },
        { item: 'Chicken stock', qty50: '2 gal', qty100: '4 gal', qty150: '6 gal' },
        { item: 'Butter', qty50: '3 lb', qty100: '6 lb', qty150: '9 lb' },
        { item: 'Fresh sage and thyme', qty50: '1.5 cups', qty100: '3 cups', qty150: '4.5 cups' },
        { item: 'Salt and pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Layer turkey with spinach and stuffing, roll tightly, and tie.\n2) Roast at 350°F until 165°F internal temperature.\n3) Rest, slice, and finish with reduced turkey jus from stock and pan drippings.\n4) Hold sliced roulade hot with jus.',
      notes: ''
    },
    'Eggplant Parmesan': {
      ingredients: [
        { item: 'Eggplant, sliced', qty50: '28 lb', qty100: '56 lb', qty150: '84 lb' },
        { item: 'Flour', qty50: '4 lb', qty100: '8 lb', qty150: '12 lb' },
        { item: 'Egg wash', qty50: '2 gal', qty100: '4 gal', qty150: '6 gal' },
        { item: 'Breadcrumbs', qty50: '10 lb', qty100: '20 lb', qty150: '30 lb' },
        { item: 'Marinara sauce', qty50: '4 gal', qty100: '8 gal', qty150: '12 gal' },
        { item: 'Mozzarella, shredded', qty50: '10 lb', qty100: '20 lb', qty150: '30 lb' },
        { item: 'Parmesan and basil', qty50: '4 lb', qty100: '8 lb', qty150: '12 lb' }
      ],
      instructions: '1) Bread and bake or fry eggplant slices until golden.\n2) Layer eggplant with marinara, mozzarella, and parmesan in hotel pans.\n3) Bake until bubbling and browned.\n4) Rest before cutting and garnish with basil.',
      notes: 'Vegetarian'
    },
    'Lemon Tart': {
      ingredients: [
        { item: 'Tart shells, baked', qty50: '50 ea', qty100: '100 ea', qty150: '150 ea' },
        { item: 'Lemon juice', qty50: '2 qt', qty100: '4 qt', qty150: '6 qt' },
        { item: 'Lemon zest', qty50: '2 cups', qty100: '4 cups', qty150: '6 cups' },
        { item: 'Sugar', qty50: '10 lb', qty100: '20 lb', qty150: '30 lb' },
        { item: 'Eggs', qty50: '90', qty100: '180', qty150: '270' },
        { item: 'Butter', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Heavy cream', qty50: '1 gal', qty100: '2 gal', qty150: '3 gal' }
      ],
      instructions: '1) Whisk lemon juice, zest, sugar, and eggs over gentle heat until thickened.\n2) Blend in butter and cream until smooth curd forms.\n3) Fill tart shells and bake briefly to set.\n4) Chill before slicing and service.',
      notes: ''
    },
    'Potato & Bacon Chowder': {
      ingredients: [
        { item: 'Russet potatoes, diced', qty50: '28 lb', qty100: '56 lb', qty150: '84 lb' },
        { item: 'Bacon, diced', qty50: '12 lb', qty100: '24 lb', qty150: '36 lb' },
        { item: 'Onions, diced', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Celery, diced', qty50: '6 lb', qty100: '12 lb', qty150: '18 lb' },
        { item: 'Chicken stock', qty50: '4 gal', qty100: '8 gal', qty150: '12 gal' },
        { item: 'Heavy cream', qty50: '2 gal', qty100: '4 gal', qty150: '6 gal' },
        { item: 'Thyme, salt, pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Render bacon and reserve some for garnish.\n2) Sweat onion and celery in bacon fat, then add potatoes and stock.\n3) Simmer until tender and finish with cream.\n4) Season and garnish with crisp bacon before service.',
      notes: 'GF'
    },
    'Classic Wedge Salad': {
      ingredients: [
        { item: 'Iceberg lettuce heads', qty50: '28 ea', qty100: '56 ea', qty150: '84 ea' },
        { item: 'Cherry tomatoes, halved', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Bacon bits', qty50: '5 lb', qty100: '10 lb', qty150: '15 lb' },
        { item: 'Blue cheese crumbles', qty50: '5 lb', qty100: '10 lb', qty150: '15 lb' },
        { item: 'Red onion, minced', qty50: '3 lb', qty100: '6 lb', qty150: '9 lb' },
        { item: 'Blue cheese dressing', qty50: '2.5 qt', qty100: '5 qt', qty150: '7.5 qt' },
        { item: 'Black pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Cut lettuce into chilled wedges and hold crisp in perforated pans.\n2) Prepare garnish components and keep cold.\n3) Top each wedge with dressing, tomatoes, bacon, onion, and blue cheese.\n4) Finish with cracked pepper at service.',
      notes: 'GF'
    },
    'Seared Scallops': {
      ingredients: [
        { item: 'Sea scallops, U10', qty50: '22 lb', qty100: '44 lb', qty150: '66 lb' },
        { item: 'Neutral oil', qty50: '1.5 qt', qty100: '3 qt', qty150: '4.5 qt' },
        { item: 'Butter', qty50: '3 lb', qty100: '6 lb', qty150: '9 lb' },
        { item: 'Lemon juice', qty50: '1.5 cups', qty100: '3 cups', qty150: '4.5 cups' },
        { item: 'Chives, chopped', qty50: '1 cup', qty100: '2 cups', qty150: '3 cups' },
        { item: 'Salt and pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Pat scallops dry and season right before cooking.\n2) Sear in hot oil until caramelized on both sides.\n3) Finish with butter and lemon in the pan.\n4) Garnish with chives and serve immediately.',
      notes: 'GF'
    },
    'Beef Stroganoff': {
      ingredients: [
        { item: 'Beef sirloin strips', qty50: '24 lb', qty100: '48 lb', qty150: '72 lb' },
        { item: 'Mushrooms, sliced', qty50: '14 lb', qty100: '28 lb', qty150: '42 lb' },
        { item: 'Onions, sliced', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Beef stock', qty50: '3 gal', qty100: '6 gal', qty150: '9 gal' },
        { item: 'Sour cream', qty50: '1.5 gal', qty100: '3 gal', qty150: '4.5 gal' },
        { item: 'Dijon mustard', qty50: '2 cups', qty100: '4 cups', qty150: '6 cups' },
        { item: 'Paprika, salt, pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Sear beef quickly in batches and reserve.\n2) Cook onions and mushrooms; add paprika and deglaze with stock.\n3) Simmer briefly, then fold in sour cream and Dijon off heat.\n4) Return beef to sauce, reheat gently, and serve.',
      notes: ''
    },
    'Cheesecake Bars': {
      ingredients: [
        { item: 'Cream cheese', qty50: '18 lb', qty100: '36 lb', qty150: '54 lb' },
        { item: 'Sugar', qty50: '9 lb', qty100: '18 lb', qty150: '27 lb' },
        { item: 'Eggs', qty50: '72', qty100: '144', qty150: '216' },
        { item: 'Vanilla extract', qty50: '6 oz', qty100: '12 oz', qty150: '18 oz' },
        { item: 'Graham cracker crumbs', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Butter, melted', qty50: '4 lb', qty100: '8 lb', qty150: '12 lb' },
        { item: 'Sour cream', qty50: '4 lb', qty100: '8 lb', qty150: '12 lb' }
      ],
      instructions: '1) Press graham crumb and butter mixture into sheet pans for crust.\n2) Mix cream cheese, sugar, eggs, vanilla, and sour cream until smooth.\n3) Spread over crust and bake until center is just set.\n4) Chill fully and cut into bars for service.',
      notes: ''
    },
    'Roasted Cauliflower Soup': {
      ingredients: [
        { item: 'Cauliflower florets', qty50: '30 lb', qty100: '60 lb', qty150: '90 lb' },
        { item: 'Onions, diced', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Garlic, minced', qty50: '12 oz', qty100: '24 oz', qty150: '36 oz' },
        { item: 'Vegetable stock', qty50: '5 gal', qty100: '10 gal', qty150: '15 gal' },
        { item: 'Heavy cream', qty50: '1 gal', qty100: '2 gal', qty150: '3 gal' },
        { item: 'Olive oil', qty50: '1 qt', qty100: '2 qt', qty150: '3 qt' },
        { item: 'Nutmeg, salt, pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Roast cauliflower with olive oil until browned and sweet.\n2) Sweat onions and garlic, then add stock and roasted cauliflower.\n3) Simmer, blend smooth, and finish with cream.\n4) Season and hold hot for service.',
      notes: 'GF'
    },
    'Arugula & Shaved Parmesan Salad': {
      ingredients: [
        { item: 'Baby arugula', qty50: '9 lb', qty100: '18 lb', qty150: '27 lb' },
        { item: 'Parmesan, shaved', qty50: '4.5 lb', qty100: '9 lb', qty150: '13.5 lb' },
        { item: 'Cherry tomatoes', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Lemon juice', qty50: '2 cups', qty100: '4 cups', qty150: '6 cups' },
        { item: 'Olive oil', qty50: '2.5 qt', qty100: '5 qt', qty150: '7.5 qt' },
        { item: 'Salt and black pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Chill arugula and garnish components.\n2) Make simple lemon dressing with juice and olive oil.\n3) Toss arugula lightly and top with parmesan and tomatoes.\n4) Serve immediately to maintain texture.',
      notes: 'GF'
    },
    'Grilled Chicken Pesto': {
      ingredients: [
        { item: 'Chicken breast, 6 oz portions', qty50: '19 lb', qty100: '38 lb', qty150: '57 lb' },
        { item: 'Basil pesto', qty50: '2 qt', qty100: '4 qt', qty150: '6 qt' },
        { item: 'Olive oil', qty50: '1 qt', qty100: '2 qt', qty150: '3 qt' },
        { item: 'Garlic, minced', qty50: '10 oz', qty100: '20 oz', qty150: '30 oz' },
        { item: 'Lemon juice', qty50: '1 qt', qty100: '2 qt', qty150: '3 qt' },
        { item: 'Salt and pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Marinate chicken with olive oil, garlic, lemon, salt, and pepper.\n2) Grill to 165°F internal and rest before slicing.\n3) Warm pesto gently and spoon over chicken at service.\n4) Hold hot above 140°F.',
      notes: 'GF'
    },
    'Mushroom Tagliatelle': {
      ingredients: [
        { item: 'Tagliatelle pasta, dry', qty50: '14 lb', qty100: '28 lb', qty150: '42 lb' },
        { item: 'Mixed mushrooms, sliced', qty50: '18 lb', qty100: '36 lb', qty150: '54 lb' },
        { item: 'Shallots, minced', qty50: '4 lb', qty100: '8 lb', qty150: '12 lb' },
        { item: 'Garlic, minced', qty50: '12 oz', qty100: '24 oz', qty150: '36 oz' },
        { item: 'Heavy cream', qty50: '2 gal', qty100: '4 gal', qty150: '6 gal' },
        { item: 'Parmesan, grated', qty50: '6 lb', qty100: '12 lb', qty150: '18 lb' },
        { item: 'Parsley, salt, pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Cook tagliatelle al dente and reserve with a little pasta water.\n2) Sauté mushrooms, shallots, and garlic until concentrated.\n3) Add cream and parmesan to form sauce, then toss with pasta.\n4) Finish with parsley and seasoning before service.',
      notes: 'Vegetarian'
    },
    'Berry Shortcake': {
      ingredients: [
        { item: 'Shortcake biscuits', qty50: '50 ea', qty100: '100 ea', qty150: '150 ea' },
        { item: 'Mixed berries', qty50: '20 lb', qty100: '40 lb', qty150: '60 lb' },
        { item: 'Sugar', qty50: '5 lb', qty100: '10 lb', qty150: '15 lb' },
        { item: 'Lemon juice', qty50: '1.5 cups', qty100: '3 cups', qty150: '4.5 cups' },
        { item: 'Heavy cream', qty50: '2 gal', qty100: '4 gal', qty150: '6 gal' },
        { item: 'Vanilla extract', qty50: '4 oz', qty100: '8 oz', qty150: '12 oz' }
      ],
      instructions: '1) Macerate berries with sugar and lemon juice for at least 30 minutes.\n2) Whip cream with vanilla to soft peaks.\n3) Split biscuits and fill with berries and whipped cream.\n4) Assemble close to service to prevent sogginess.',
      notes: ''
    },
    'Lentil & Herb Soup': {
      ingredients: [
        { item: 'Brown lentils, dry', qty50: '10 lb', qty100: '20 lb', qty150: '30 lb' },
        { item: 'Onions, diced', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Carrots, diced', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Celery, diced', qty50: '6 lb', qty100: '12 lb', qty150: '18 lb' },
        { item: 'Vegetable stock', qty50: '5 gal', qty100: '10 gal', qty150: '15 gal' },
        { item: 'Tomato paste', qty50: '2 lb', qty100: '4 lb', qty150: '6 lb' },
        { item: 'Parsley, thyme, bay, salt, pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Sweat mirepoix and tomato paste until aromatic.\n2) Add lentils, herbs, and stock; simmer until lentils are tender.\n3) Blend a small portion to thicken, then combine back in.\n4) Adjust seasoning and hold hot for service.',
      notes: 'GF/V'
    },
    'Cabbage Slaw with Apple Cider Vinaigrette': {
      ingredients: [
        { item: 'Green cabbage, shredded', qty50: '16 lb', qty100: '32 lb', qty150: '48 lb' },
        { item: 'Red cabbage, shredded', qty50: '10 lb', qty100: '20 lb', qty150: '30 lb' },
        { item: 'Carrots, julienned', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Apple cider vinegar', qty50: '2 cups', qty100: '4 cups', qty150: '6 cups' },
        { item: 'Canola oil', qty50: '2 qt', qty100: '4 qt', qty150: '6 qt' },
        { item: 'Honey and Dijon', qty50: '1.5 cups', qty100: '3 cups', qty150: '4.5 cups' },
        { item: 'Celery seed, salt, pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Combine shredded cabbages and carrots in chilled pans.\n2) Whisk vinegar, oil, honey, Dijon, and spices for vinaigrette.\n3) Toss slaw with dressing shortly before service.\n4) Keep refrigerated and stir periodically.',
      notes: 'GF/V'
    },
    'Braised Pork Shoulder': {
      ingredients: [
        { item: 'Pork shoulder, boneless', qty50: '30 lb', qty100: '60 lb', qty150: '90 lb' },
        { item: 'Onions, diced', qty50: '10 lb', qty100: '20 lb', qty150: '30 lb' },
        { item: 'Garlic, minced', qty50: '14 oz', qty100: '28 oz', qty150: '42 oz' },
        { item: 'Chicken stock', qty50: '4 gal', qty100: '8 gal', qty150: '12 gal' },
        { item: 'Tomato paste', qty50: '2 lb', qty100: '4 lb', qty150: '6 lb' },
        { item: 'Apple cider vinegar', qty50: '2 cups', qty100: '4 cups', qty150: '6 cups' },
        { item: 'Paprika, thyme, salt, pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Season and sear pork shoulders until browned on all sides.\n2) Add aromatics, tomato paste, stock, and vinegar to braising pans.\n3) Cover and braise at 325°F until fork-tender (about 3 hours).\n4) Slice or pull pork, reduce braising liquid, and serve with jus.',
      notes: 'GF/DF'
    },
    'Stuffed Peppers': {
      ingredients: [
        { item: 'Bell peppers, halved', qty50: '100 halves', qty100: '200 halves', qty150: '300 halves' },
        { item: 'Cooked rice', qty50: '14 lb', qty100: '28 lb', qty150: '42 lb' },
        { item: 'Ground turkey', qty50: '20 lb', qty100: '40 lb', qty150: '60 lb' },
        { item: 'Onions, diced', qty50: '8 lb', qty100: '16 lb', qty150: '24 lb' },
        { item: 'Tomato sauce', qty50: '3 gal', qty100: '6 gal', qty150: '9 gal' },
        { item: 'Mozzarella, shredded', qty50: '6 lb', qty100: '12 lb', qty150: '18 lb' },
        { item: 'Italian herbs, salt, pepper', qty50: 'to taste', qty100: 'to taste', qty150: 'to taste' }
      ],
      instructions: '1) Par-cook pepper halves until slightly tender.\n2) Cook turkey with onions and combine with rice, tomato sauce, and herbs.\n3) Fill peppers, top with mozzarella, and bake until hot and melted.\n4) Hold warm for service.',
      notes: 'GF'
    },
    'Bread Pudding with Vanilla Sauce': {
      ingredients: [
        { item: 'Day-old brioche, cubed', qty50: '18 lb', qty100: '36 lb', qty150: '54 lb' },
        { item: 'Whole milk', qty50: '3 gal', qty100: '6 gal', qty150: '9 gal' },
        { item: 'Heavy cream', qty50: '2 gal', qty100: '4 gal', qty150: '6 gal' },
        { item: 'Eggs', qty50: '80', qty100: '160', qty150: '240' },
        { item: 'Sugar', qty50: '10 lb', qty100: '20 lb', qty150: '30 lb' },
        { item: 'Vanilla extract', qty50: '8 oz', qty100: '16 oz', qty150: '24 oz' },
        { item: 'Butter and cinnamon', qty50: '3 lb', qty100: '6 lb', qty150: '9 lb' }
      ],
      instructions: '1) Whisk custard with milk, cream, eggs, sugar, vanilla, and cinnamon.\n2) Fold in brioche cubes and soak until saturated.\n3) Bake in buttered pans until puffed and set.\n4) Serve warm with vanilla sauce.',
      notes: ''
    }
  };

  function recipe(title) {
    const entry = catalog[title];
    return {
      title,
      yields: ['50', '100', '150'],
      ingredients: entry.ingredients,
      instructions: entry.instructions,
      notes: entry.notes || ''
    };
  }

  const week2Recipes = {
    Monday: {
      soup: recipe('Carrot Ginger Soup'),
      salad: recipe('Baby Kale, Quinoa & Pomegranate Salad'),
      main1: recipe('Grilled Swordfish with Caponata'),
      main2: recipe('Chicken Marsala'),
      dessert: recipe('Coconut Rice Pudding')
    },
    Tuesday: {
      soup: recipe('French Onion Soup'),
      salad: recipe('Roasted Beet & Goat Cheese Salad'),
      main1: recipe('Lamb Meatballs with Yogurt Sauce'),
      main2: recipe('Spinach & Ricotta Cannelloni'),
      dessert: recipe('Chocolate Mousse')
    },
    Wednesday: {
      soup: recipe('Leek & Potato Soup'),
      salad: recipe('Shaved Brussels Sprouts & Parmesan Salad'),
      main1: recipe('Miso-Glazed Salmon'),
      main2: recipe('Pork Schnitzel'),
      dessert: recipe('Vanilla Poached Pears')
    },
    Thursday: {
      soup: recipe('Tomato Bisque'),
      salad: recipe('Mixed Greens with Champagne Vinaigrette'),
      main1: recipe('Turkey Roulade'),
      main2: recipe('Eggplant Parmesan'),
      dessert: recipe('Lemon Tart')
    },
    Friday: {
      soup: recipe('Potato & Bacon Chowder'),
      salad: recipe('Classic Wedge Salad'),
      main1: recipe('Seared Scallops'),
      main2: recipe('Beef Stroganoff'),
      dessert: recipe('Cheesecake Bars')
    },
    Saturday: {
      soup: recipe('Roasted Cauliflower Soup'),
      salad: recipe('Arugula & Shaved Parmesan Salad'),
      main1: recipe('Grilled Chicken Pesto'),
      main2: recipe('Mushroom Tagliatelle'),
      dessert: recipe('Berry Shortcake')
    },
    Sunday: {
      soup: recipe('Lentil & Herb Soup'),
      salad: recipe('Cabbage Slaw with Apple Cider Vinaigrette'),
      main1: recipe('Braised Pork Shoulder'),
      main2: recipe('Stuffed Peppers'),
      dessert: recipe('Bread Pudding with Vanilla Sauce')
    }
  };

  globalThis.lunchRecipesWeek1 = globalThis.lunchRecipesWeek1 || {};
  globalThis.lunchRecipesWeek1['Week 2'] = week2Recipes;
})();
