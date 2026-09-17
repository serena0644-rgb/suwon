export type KakaoPlace = {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  phone: string;
  place_url: string;
  distance: string;
};

export type KakaoLatLng = {
  getLat: () => number;
  getLng: () => number;
};

export type KakaoLatLngBounds = {
  extend: (latlng: KakaoLatLng) => void;
  isEmpty: () => boolean;
};

export type KakaoMap = {
  getLevel: () => number;
  panTo: (latlng: KakaoLatLng) => void;
  relayout: () => void;
  setBounds: (
    bounds: KakaoLatLngBounds,
    paddingTop?: number,
    paddingRight?: number,
    paddingBottom?: number,
    paddingLeft?: number,
  ) => void;
  setCenter: (latlng: KakaoLatLng) => void;
  setLevel: (level: number) => void;
};

export type KakaoMarker = {
  setMap: (map: KakaoMap | null) => void;
  setPosition: (latlng: KakaoLatLng) => void;
  setZIndex: (zIndex: number) => void;
};

export type KakaoPolyline = {
  setMap: (map: KakaoMap | null) => void;
  setOptions: (options: Record<string, unknown>) => void;
  setPath: (path: KakaoLatLng[]) => void;
};

export type KakaoCircle = {
  setMap: (map: KakaoMap | null) => void;
  setPosition: (latlng: KakaoLatLng) => void;
  setRadius: (radius: number) => void;
};

export type KakaoCustomOverlay = {
  setContent: (content: HTMLElement | string) => void;
  setMap: (map: KakaoMap | null) => void;
  setPosition: (latlng: KakaoLatLng) => void;
};

export type KakaoMouseEvent = {
  latLng: KakaoLatLng;
};

export type KakaoMaps = {
  services: {
    Places: new () => {
      keywordSearch: (
        keyword: string,
        callback: (items: KakaoPlace[], status: string) => void,
        options?: SearchOptions,
      ) => void;
      categorySearch: (
        category: string,
        callback: (items: KakaoPlace[], status: string) => void,
        options: SearchOptions,
      ) => void;
    };
    Status: { OK: string; ZERO_RESULT: string };
    SortBy: { DISTANCE: string };
  };
  Circle: new (options: {
    fillColor?: string;
    fillOpacity?: number;
    map?: KakaoMap;
    radius: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: string;
    strokeWeight?: number;
    center: KakaoLatLng;
  }) => KakaoCircle;
  CustomOverlay: new (options: {
    clickable?: boolean;
    content: HTMLElement | string;
    map?: KakaoMap;
    position: KakaoLatLng;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
  }) => KakaoCustomOverlay;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  Marker: new (options: {
    map?: KakaoMap;
    position: KakaoLatLng;
    title?: string;
    zIndex?: number;
  }) => KakaoMarker;
  Polyline: new (options: {
    endArrow?: boolean;
    map?: KakaoMap;
    path: KakaoLatLng[];
    strokeColor: string;
    strokeOpacity: number;
    strokeStyle: string;
    strokeWeight: number;
    zIndex?: number;
  }) => KakaoPolyline;
  event: {
    addListener: (
      target: unknown,
      type: string,
      handler: (event: KakaoMouseEvent) => void,
    ) => void;
    removeListener: (
      target: unknown,
      type: string,
      handler: (event: KakaoMouseEvent) => void,
    ) => void;
  };
  load: (callback: () => void) => void;
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

export {};
export type SearchOptions = {
  location?: KakaoLatLng;
  radius?: number;
  sort?: string;
  category_group_code?: string;
};
