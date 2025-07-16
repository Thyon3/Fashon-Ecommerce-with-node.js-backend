npm install node cron 

const cron = require("node-cron"); 
const Product = require ('../models/product')
const Category = require(
'../models/category'
);
const cartItemModel = require('../models/cart_item')
const { default: mongoose } = require("mongoose");

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

});

cron.schedule('/30 * * * * ',async function (req,res){
  const session = await mongoose.startSession(); 
  session.startTransaction() ; 
  try{
    // find the expired reservations from CartItem collection 
    const expiredReservations = await cartItemModel.find({
      reserved: true,
      reservationExpiry: {$lte: new Date()}
    }).session(session);

    for(const cartItem of expiredReservations){
      // find the associated product and add the quantity of the cart 
      const product = await Product.findById(cartItem.product).session(session); 
      if(product){
        const updatedProduct = await Product.findByIdAndUpdate(product._id,
          {$inc: {numberInStock: cartItem.quantity}},
          {new :true, runValidators: true , session}
        )
        if(!updatedProduct){
          console.error(error); 
          await session.abortTransaction(); 
          return;
        }
      }
      await cartItemModel.findByIdAndUpdate(cartItem._id , {reserved: false},{session})
    }
    console.log('product got back to stock succesffully');
    await session.commitTransaction(); 
    return; 
  }catch(error){
    console.error(error); 
    await session.abortTransaction(); 
    return res.status(500).json({
      type: error.name, 
      message: error.message
    })
  }finally{
    await session.endSession(); 
  }
})