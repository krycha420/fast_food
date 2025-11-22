import { ID } from "react-native-appwrite";
import { appwriteConfig, databases, storage } from "./appwrite";
import dummyData from "./data";

interface Category {
    name: string;
    description: string;
}

interface Customization {
    name: string;
    price: number;
    type: "topping" | "side" | "size" | "crust" | string;
}

interface MenuItem {
    name: string;
    description: string;
    image_url: string;
    price: number;
    rating: number;
    calories: number;
    protein: number;
    category_name: string;
    customizations: string[];
}

interface DummyData {
    categories: Category[];
    customizations: Customization[];
    menu: MenuItem[];
}

const data = dummyData as DummyData;

// --- Prevent multiple seed runs ---
let isSeeding = false;

// --- Safe deletion helpers ---
async function safeDeleteDocument(collectionId: string, docId: string) {
    try {
        await databases.deleteDocument(appwriteConfig.databaseId, collectionId, docId);
    } catch (err: any) {
        if (err.code !== 404) throw err;
    }
}

async function clearAll(collectionId: string) {
    const list = await databases.listDocuments(appwriteConfig.databaseId, collectionId);
    await Promise.all(list.documents.map(doc => safeDeleteDocument(collectionId, doc.$id)));
}

async function safeDeleteFile(fileId: string) {
    try {
        await storage.deleteFile(appwriteConfig.bucketId, fileId);
    } catch (err: any) {
        if (err.code !== 404) throw err;
    }
}

async function clearStorage() {
    const list = await storage.listFiles(appwriteConfig.bucketId);
    await Promise.all(list.files.map(file => safeDeleteFile(file.$id)));
}

// --- Safe image upload ---
async function uploadImageToStorage(imageUrl: string) {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error("Failed to fetch image");
        const blob = await response.blob();

        const file = await storage.createFile(
            appwriteConfig.bucketId,
            ID.unique(),
            {
                name: imageUrl.split("/").pop() || `file-${Date.now()}.jpg`,
                type: blob.type,
                size: blob.size,
                uri: imageUrl,
            }
        );

        return storage.getFileViewURL(appwriteConfig.bucketId, file.$id);
    } catch (err) {
        console.warn("⚠️ Failed to upload image, using placeholder:", imageUrl, err);
        return "https://via.placeholder.com/150";
    }
}

// --- Seed function ---
async function seed() {
    if (isSeeding) {
        console.log("⚠️ Seed already running. Ignoring second click.");
        return;
    }
    isSeeding = true;

    try {
        console.log("🧹 Clearing existing collections and storage...");
        await clearAll(appwriteConfig.categoriesCollectionId);
        await clearAll(appwriteConfig.customizationsCollectionId);
        await clearAll(appwriteConfig.menuCollectionId);
        await clearAll(appwriteConfig.menuCustomizationsCollectionId);
        await clearStorage();

        // --- Create categories ---
        const categoryMap: Record<string, string> = {};
        for (const cat of data.categories) {
            try {
                const doc = await databases.createDocument(
                    appwriteConfig.databaseId,
                    appwriteConfig.categoriesCollectionId,
                    ID.unique(),
                    cat
                );
                categoryMap[cat.name] = doc.$id;
            } catch (err) {
                console.warn("Failed to create category:", cat.name, err);
            }
        }

        // --- Create customizations ---
        const customizationMap: Record<string, string> = {};
        for (const cus of data.customizations) {
            try {
                const doc = await databases.createDocument(
                    appwriteConfig.databaseId,
                    appwriteConfig.customizationsCollectionId,
                    ID.unique(),
                    cus
                );
                customizationMap[cus.name] = doc.$id;
            } catch (err) {
                console.warn("Failed to create customization:", cus.name, err);
            }
        }

        // --- Create menu items ---
        for (const item of data.menu) {
            try {
                const uploadedImage = await uploadImageToStorage(item.image_url);

                const menuDoc = await databases.createDocument(
                    appwriteConfig.databaseId,
                    appwriteConfig.menuCollectionId,
                    ID.unique(),
                    {
                        name: item.name,
                        description: item.description,
                        image_url: uploadedImage,
                        price: item.price,
                        rating: item.rating,
                        calories: item.calories,
                        protein: item.protein,
                        categories: categoryMap[item.category_name], // single ID (many-to-one)
                    }
                );

                // --- Create menu_customizations ---
                for (const cusName of item.customizations) {
                    try {
                        await databases.createDocument(
                            appwriteConfig.databaseId,
                            appwriteConfig.menuCustomizationsCollectionId,
                            ID.unique(),
                            {
                                menu: menuDoc.$id,                         // single ID (many-to-one)
                                customizations: customizationMap[cusName]  // single ID (many-to-one)
                            }
                        );
                    } catch (err) {
                        console.warn("Failed to create menu customization:", item.name, cusName, err);
                    }
                }
            } catch (err) {
                console.warn("Failed to create menu item:", item.name, err);
            }
        }

        console.log("✅ Seeding complete.");
    } catch (err) {
        console.log("❌ Seed error:", err);
    } finally {
        isSeeding = false;
    }
}

export default seed;
