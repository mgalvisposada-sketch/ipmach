import { processSingleSource } from '../src/lib/scrapers/single-source-processor';

async function testPartequipos() {
  console.log('🔍 Testing Partequipos search...');
  console.log('Reference: 1R0750');
  console.log('---');

  try {
    const result = await processSingleSource('PARTEQUIPOS', '1R0750');

    if (result.success) {
      console.log('✅ Search successful!');
      console.log(`Found ${result.data?.products?.length || 0} products`);
      console.log('---');

      if (result.data && result.data.products && result.data.products.length > 0) {
        console.log('Products found:');
        result.data.products.forEach((product, index) => {
          console.log(`\n${index + 1}. ${product.reference || 'N/A'}`);
          console.log(`   Description: ${product.description || 'N/A'}`);
          console.log(`   Price: ${product.price || 'N/A'}`);
          console.log(`   Stock: ${product.stock || 0}`);
          console.log(`   Has Stock: ${product.hasStock ? 'Yes' : 'No'}`);
          console.log(`   Origin: ${product.origin || 'N/A'}`);
        });
      } else {
        console.log('⚠️ No products found');
      }

      if (result.data?.metadata) {
        console.log('\n---');
        console.log('Metadata:');
        console.log(JSON.stringify(result.data.metadata, null, 2));
      }
    } else {
      console.error('❌ Search failed!');
      console.error('Error:', result.error);
    }
  } catch (error: any) {
    console.error('❌ Error executing search:');
    console.error(error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    console.log('\n---');
    console.log('Cleaning up...');
    process.exit(0);
  }
}

testPartequipos();

