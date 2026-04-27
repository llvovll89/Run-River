declare namespace kakao {
  namespace maps {
    class Map {
      constructor(container: HTMLElement, options: MapOptions);
      setCenter(latlng: LatLng): void;
      getCenter(): LatLng;
      setLevel(level: number): void;
      getLevel(): number;
      panTo(latlng: LatLng): void;
    }

    class LatLng {
      constructor(lat: number, lng: number);
      getLat(): number;
      getLng(): number;
    }

    class Marker {
      constructor(options: MarkerOptions);
      setMap(map: Map | null): void;
      setPosition(latlng: LatLng): void;
      getPosition(): LatLng;
    }

    class CustomOverlay {
      constructor(options: CustomOverlayOptions);
      setMap(map: Map | null): void;
      setPosition(latlng: LatLng): void;
      setContent(content: string | HTMLElement): void;
    }

    class Circle {
      constructor(options: CircleOptions);
      setMap(map: Map | null): void;
    }

    class Polyline {
      constructor(options: PolylineOptions);
      setMap(map: Map | null): void;
      setPath(path: LatLng[]): void;
      getPath(): LatLng[];
    }

    namespace event {
      function addListener(
        target: Map | Marker,
        type: string,
        handler: (event: MouseEvent) => void
      ): void;
      function removeListener(
        target: Map | Marker,
        type: string,
        handler: (event: MouseEvent) => void
      ): void;
    }

    namespace services {
      class Geocoder {
        coord2Address(
          lng: number,
          lat: number,
          callback: (result: Address[], status: string) => void
        ): void;
      }
      class Places {
        constructor();
        keywordSearch(
          keyword: string,
          callback: (result: PlaceResult[], status: string) => void,
          options?: { location?: LatLng; radius?: number; size?: number }
        ): void;
      }
      const Status: {
        OK: string;
        ZERO_RESULT: string;
        ERROR: string;
      };
      interface PlaceResult {
        id: string;
        place_name: string;
        address_name: string;
        road_address_name: string;
        x: string; // longitude
        y: string; // latitude
        category_name: string;
      }
    }

    interface MapOptions {
      center: LatLng;
      level: number;
    }

    interface MarkerOptions {
      position: LatLng;
      map?: Map;
      image?: MarkerImage;
      draggable?: boolean;
    }

    interface MarkerImage {
      src: string;
      size: Size;
    }

    interface Size {
      width: number;
      height: number;
    }

    class Size {
      constructor(width: number, height: number);
    }

    class Point {
      constructor(x: number, y: number);
    }

    class MarkerImage {
      constructor(src: string, size: Size, options?: { offset?: Point });
    }

    interface CustomOverlayOptions {
      position: LatLng;
      content: string | HTMLElement;
      map?: Map;
      yAnchor?: number;
    }

    interface CircleOptions {
      center: LatLng;
      radius: number;
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      fillColor?: string;
      fillOpacity?: number;
      map?: Map;
    }

    interface PolylineOptions {
      path: LatLng[];
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeStyle?: string;
      map?: Map;
    }

    interface MouseEvent {
      latLng: LatLng;
    }

    function load(callback: () => void): void;

    interface Address {
      address: {
        address_name: string;
        region_1depth_name: string;
        region_2depth_name: string;
        region_3depth_name: string;
      };
    }
  }
}
