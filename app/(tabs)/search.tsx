import {View, Text, Button} from 'react-native'
import React from 'react'
import {SafeAreaView} from "react-native-safe-area-context";
import seed from "@/app/lib/seed";

export default function Search() {
    return (
        <SafeAreaView>
            <Text>Search</Text>
            <Button title ="Seed" onPress={() =>seed().catch((error) => {console.log("Failed to seed the database", error),  console.log("code:", error.code);
                console.log("type:", error.type);
                console.log("message:", error.message);
                console.log("raw:", error);})}/>
        </SafeAreaView>
    )
}
