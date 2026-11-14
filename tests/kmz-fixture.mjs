import {zipSync, strToU8} from "fflate";

export const kmlFixture = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>북한산 KMZ 표시</name>
<Style id="external"><IconStyle><Icon><href>https://kmz-resource.invalid/icon.png</href></Icon></IconStyle></Style>
<NetworkLink><Link><href>https://kmz-resource.invalid/remote.kml</href></Link></NetworkLink>
<Placemark><name>쉼터</name><Point><coordinates>126.98,37.66,300</coordinates></Point></Placemark>
<Placemark><name>남쪽 코스</name><LineString><coordinates>126.975,37.655 126.985,37.665</coordinates></LineString></Placemark>
<Placemark><name>북쪽 코스</name><LineString><coordinates>126.975,37.675 126.985,37.685</coordinates></LineString></Placemark>
<Placemark><name>산행 구역</name><Polygon><outerBoundaryIs><LinearRing><coordinates>126.97,37.65 126.99,37.65 126.99,37.69 126.97,37.69 126.97,37.65</coordinates></LinearRing></outerBoundaryIs>
<innerBoundaryIs><LinearRing><coordinates>126.977,37.667 126.983,37.667 126.983,37.673 126.977,37.673 126.977,37.667</coordinates></LinearRing></innerBoundaryIs></Polygon></Placemark>
</Document></kml>`;
export const kmzFixture = zipSync({"doc.kml": strToU8(kmlFixture), "images/unused.png": new Uint8Array([1, 2, 3])});
