/**
 * The 64 districts of Bangladesh with the approximate position of each district town.
 * Used by Cash on Delivery orders to compare the delivery address with the phone's
 * current location (haversine distance in km).
 */
const DISTRICTS = [
  // Dhaka division
  ['dhaka', 'ঢাকা', 23.8103, 90.4125], ['gazipur', 'গাজীপুর', 23.9999, 90.4203],
  ['narayanganj', 'নারায়ণগঞ্জ', 23.6238, 90.5000], ['narsingdi', 'নরসিংদী', 23.9322, 90.7151],
  ['manikganj', 'মানিকগঞ্জ', 23.8617, 90.0003], ['munshiganj', 'মুন্সীগঞ্জ', 23.5422, 90.5305],
  ['tangail', 'টাঙ্গাইল', 24.2513, 89.9167], ['kishoreganj', 'কিশোরগঞ্জ', 24.4449, 90.7766],
  ['faridpur', 'ফরিদপুর', 23.6071, 89.8429], ['gopalganj', 'গোপালগঞ্জ', 23.0050, 89.8266],
  ['madaripur', 'মাদারীপুর', 23.1641, 90.1897], ['rajbari', 'রাজবাড়ী', 23.7574, 89.6444],
  ['shariatpur', 'শরীয়তপুর', 23.2423, 90.4348],
  // Mymensingh division
  ['mymensingh', 'ময়মনসিংহ', 24.7471, 90.4203], ['jamalpur', 'জামালপুর', 24.9375, 89.9378],
  ['netrokona', 'নেত্রকোনা', 24.8709, 90.7279], ['sherpur', 'শেরপুর', 25.0205, 90.0153],
  // Chattogram division
  ['chattogram', 'চট্টগ্রাম', 22.3569, 91.7832], ['coxsbazar', 'কক্সবাজার', 21.4272, 92.0058],
  ['cumilla', 'কুমিল্লা', 23.4607, 91.1809], ['feni', 'ফেনী', 23.0159, 91.3976],
  ['noakhali', 'নোয়াখালী', 22.8696, 91.0995], ['lakshmipur', 'লক্ষ্মীপুর', 22.9447, 90.8282],
  ['chandpur', 'চাঁদপুর', 23.2333, 90.6713], ['brahmanbaria', 'ব্রাহ্মণবাড়িয়া', 23.9571, 91.1119],
  ['rangamati', 'রাঙ্গামাটি', 22.6533, 92.1751], ['khagrachhari', 'খাগড়াছড়ি', 23.1193, 91.9847],
  ['bandarban', 'বান্দরবান', 22.1953, 92.2184],
  // Rajshahi division
  ['rajshahi', 'রাজশাহী', 24.3745, 88.6042], ['natore', 'নাটোর', 24.4206, 88.9832],
  ['naogaon', 'নওগাঁ', 24.7936, 88.9318], ['chapainawabganj', 'চাঁপাইনবাবগঞ্জ', 24.5965, 88.2776],
  ['pabna', 'পাবনা', 24.0064, 89.2372], ['sirajganj', 'সিরাজগঞ্জ', 24.4534, 89.7007],
  ['bogura', 'বগুড়া', 24.8466, 89.3776], ['joypurhat', 'জয়পুরহাট', 25.0968, 89.0227],
  // Rangpur division
  ['rangpur', 'রংপুর', 25.7439, 89.2752], ['dinajpur', 'দিনাজপুর', 25.6217, 88.6354],
  ['thakurgaon', 'ঠাকুরগাঁও', 26.0337, 88.4617], ['panchagarh', 'পঞ্চগড়', 26.3411, 88.5542],
  ['nilphamari', 'নীলফামারী', 25.9310, 88.8560], ['lalmonirhat', 'লালমনিরহাট', 25.9923, 89.2847],
  ['kurigram', 'কুড়িগ্রাম', 25.8072, 89.6295], ['gaibandha', 'গাইবান্ধা', 25.3297, 89.5430],
  // Khulna division
  ['khulna', 'খুলনা', 22.8456, 89.5403], ['bagerhat', 'বাগেরহাট', 22.6516, 89.7859],
  ['satkhira', 'সাতক্ষীরা', 22.7185, 89.0705], ['jashore', 'যশোর', 23.1664, 89.2081],
  ['jhenaidah', 'ঝিনাইদহ', 23.5450, 89.1726], ['magura', 'মাগুরা', 23.4873, 89.4198],
  ['narail', 'নড়াইল', 23.1725, 89.5127], ['kushtia', 'কুষ্টিয়া', 23.9013, 89.1204],
  ['chuadanga', 'চুয়াডাঙ্গা', 23.6402, 88.8418], ['meherpur', 'মেহেরপুর', 23.7622, 88.6318],
  // Barishal division
  ['barishal', 'বরিশাল', 22.7010, 90.3535], ['bhola', 'ভোলা', 22.6859, 90.6482],
  ['patuakhali', 'পটুয়াখালী', 22.3596, 90.3299], ['barguna', 'বরগুনা', 22.1591, 90.1262],
  ['pirojpur', 'পিরোজপুর', 22.5841, 89.9720], ['jhalokati', 'ঝালকাঠি', 22.6406, 90.1987],
  // Sylhet division
  ['sylhet', 'সিলেট', 24.8949, 91.8687], ['moulvibazar', 'মৌলভীবাজার', 24.4829, 91.7774],
  ['habiganj', 'হবিগঞ্জ', 24.3745, 91.4155], ['sunamganj', 'সুনামগঞ্জ', 25.0658, 91.3950]
].map(([id, nameBn, lat, lng]) => ({ id, nameBn, lat, lng }));

const byId = new Map(DISTRICTS.map(d => [d.id, d]));

function distanceKm(a, b) {
  const rad = x => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Bangladesh bounding box (with a little margin)
const inBangladesh = p => p.lat > 20.3 && p.lat < 26.9 && p.lng > 87.8 && p.lng < 92.9;

module.exports = { DISTRICTS, districtById: id => byId.get(id) || null, distanceKm, inBangladesh };
