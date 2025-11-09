import type { Cart } from '../scripts/cart.js';

declare global {
    export interface Custom {
        square_item_id: string;
        square_version: number;
        releaseDate: string;
        oos: string;
        square_variation_id: string;
        square_variation_version: number;
        stockable: boolean;
        sellable: boolean;
    }

    export interface Offer {
        sku: string;
        name: string;
        description: string;
        image: string[];
        priceCurrency: string;
        price: string;
        availability: string;
        custom: Custom;
    }

    export interface JSONLDData {
        sku: string;
        name: string;
        description: string;
        image: string[];
        offers: Offer[];
        custom: Custom;
    }

    export interface CartItem {
        name?: string;
        note?: string;
        sku: string;
        image: string;
        urlKey: string;
        quantity: number;
        // string if price is a decimal number
        // number if price is a whole number (in cents)
        price: string | number;
        // priceCurrency: string;
        square_item_id: string;
        square_variation_id: string;
    }

    export interface Window {
        hlx: any;
        jsonLdData: JSONLDData;
        variants: any;
        cart: Cart;
    }
}

export { };