/*
 * Additional data file to append placeholder ingredient categories for Weeks 3 and 4.
 *
 * The existing data.js file contains aggregated ingredient quantities for Weeks 1 and 2.
 * For Weeks 3 and 4, full ingredient lists are not yet available, so this script
 * appends placeholder entries with empty category arrays. Loading this script after
 * data.js ensures the menuData.menu array includes entries for every day of the
 * four-week rotation, preventing missing data errors in the UI.
 */

// Ensure menuData exists
if (typeof menuData === 'undefined') {
  var menuData = { menu: [] };
}

// Append placeholder category entries for Week 3 and Week 4
menuData.menu = menuData.menu.concat([
  // Week 3
  { week: 3, day: 'Sunday',    categories: { produce: [], protein: [], dairy: [], dry: [], other: [] } },
  { week: 3, day: 'Monday',    categories: { produce: [], protein: [], dairy: [], dry: [], other: [] } },
  { week: 3, day: 'Tuesday',   categories: { produce: [], protein: [], dairy: [], dry: [], other: [] } },
  { week: 3, day: 'Wednesday', categories: { produce: [], protein: [], dairy: [], dry: [], other: [] } },
  { week: 3, day: 'Thursday',  categories: { produce: [], protein: [], dairy: [], dry: [], other: [] } },
  { week: 3, day: 'Friday',    categories: { produce: [], protein: [], dairy: [], dry: [], other: [] } },
  { week: 3, day: 'Saturday',  categories: { produce: [], protein: [], dairy: [], dry: [], other: [] } },
  // Week 4
  { week: 4, day: 'Sunday',    categories: { produce: [], protein: [], dairy: [], dry: [], other: [] } },
  { week: 4, day: 'Monday',    categories: { produce: [], protein: [], dairy: [], dry: [], other: [] } },
  { week: 4, day: 'Tuesday',   categories: { produce: [], protein: [], dairy: [], dry: [], other: [] } },
  { week: 4, day: 'Wednesday', categories: { produce: [], protein: [], dairy: [], dry: [], other: [] } },
  { week: 4, day: 'Thursday',  categories: { produce: [], protein: [], dairy: [], dry: [], other: [] } },
  { week: 4, day: 'Friday',    categories: { produce: [], protein: [], dairy: [], dry: [], other: [] } },
  { week: 4, day: 'Saturday',  categories: { produce: [], protein: [], dairy: [], dry: [], other: [] } }
]);
