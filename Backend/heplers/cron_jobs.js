npm install node cron 

const cron = require("node-cron"); 
const Product = require ('../models/product')
const Category = require(
'../models/category'
);

// run the function every single day at midnight in the local time of the server 
cron.schedule('0 0 * * * ',async function(){
  try{
    //delete the marked categories 
    const markedCategories = await Category.find({
      markForDeletion: true
    });

    // For each marked cateogry find the one who doesn't have a product and delete it 
    for(const categoryIn of markedCategories){
      const products = Product.countDocuments({category: categoryIn});
      if(products < 1) {
        await categoryIn.deleteOne(); 
      }
      console.log(`'deleted category successfully at ' ${Date.now()}`)
    }
  }catch(error){
    console.log(`'cron job error'${error}`)
  }

})