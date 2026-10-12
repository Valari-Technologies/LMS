/**
 * Course Rating & Review Utilities
 * Provides realistic default rating baselines and dynamic student rating integration.
 *
 * Rules:
 * 1. Each course has a unique, deterministic baseline rating (e.g. 4.7, 4.8, 4.9) and count (e.g. 38 - 85).
 * 2. Whenever ANY student submits a rating (1-5 stars), the total ratings count immediately and dynamically increments,
 *    the star breakdown bar increments, and the average score dynamically recalculates.
 * 3. Written comments require admin publishing before appearing in the public carousel.
 */

export function getCourseDefaultRating(courseId, dynamicSummary = null) {
  const dynamicCount = dynamicSummary?.totalReviews || 0;

  // Derive deterministic, authentic baseline based on courseId
  const idNum = Math.abs(parseInt(courseId, 10)) || 1;

  // Base ratings range between 4.7 and 4.9
  const ratingVariations = [4.8, 4.9, 4.8, 4.7, 4.9, 4.8, 4.9, 4.7];
  // Base review counts range between 32 and 88
  const countVariations = [42, 68, 54, 38, 76, 49, 85, 62, 57, 45];

  const baseRating = ratingVariations[(idNum * 3 + 1) % ratingVariations.length];
  const baseCount = countVariations[idNum % countVariations.length] + ((idNum * 7) % 11);

  // Realistic base star distribution percentages based on the rating
  let fivePct = 0.83;
  let fourPct = 0.14;

  if (baseRating >= 4.9) {
    fivePct = 0.88;
    fourPct = 0.10;
  } else if (baseRating === 4.7) {
    fivePct = 0.77;
    fourPct = 0.18;
  }

  let fiveStars = Math.round(baseCount * fivePct);
  let fourStars = Math.round(baseCount * fourPct);
  let threeStars = Math.max(1, baseCount - fiveStars - fourStars);

  // Exact sum alignment
  if (fiveStars + fourStars + threeStars !== baseCount) {
    fiveStars = baseCount - fourStars - threeStars;
  }

  // If students have submitted dynamic ratings, dynamically add them!
  if (dynamicCount > 0) {
    const dynDist = dynamicSummary?.distribution || {};
    const dynFive = Number(dynDist[5]) || 0;
    const dynFour = Number(dynDist[4]) || 0;
    const dynThree = Number(dynDist[3]) || 0;
    const dynTwo = Number(dynDist[2]) || 0;
    const dynOne = Number(dynDist[1]) || 0;

    const totalFive = fiveStars + dynFive;
    const totalFour = fourStars + dynFour;
    const totalThree = threeStars + dynThree;
    const totalTwo = dynTwo;
    const totalOne = dynOne;

    const totalReviews = baseCount + dynamicCount;
    const dynamicStarSum = (5 * dynFive) + (4 * dynFour) + (3 * dynThree) + (2 * dynTwo) + (1 * dynOne);
    const totalSum = (baseCount * baseRating) + dynamicStarSum;
    const averageRating = Math.min(5.0, Math.round((totalSum / totalReviews) * 10) / 10);

    return {
      isDynamic: true,
      averageRating,
      totalReviews,
      distribution: {
        5: totalFive,
        4: totalFour,
        3: totalThree,
        2: totalTwo,
        1: totalOne
      }
    };
  }

  return {
    isDynamic: false,
    averageRating: baseRating,
    totalReviews: baseCount,
    distribution: {
      5: fiveStars,
      4: fourStars,
      3: threeStars,
      2: 0,
      1: 0
    }
  };
}
