require 'xcodeproj'
require 'rexml/document'
project_path=Dir.glob('ios/*.xcodeproj').first or abort 'Missing generated iOS project'
project=Xcodeproj::Project.open(project_path)
app=project.targets.find{|t| t.product_type=='com.apple.product-type.application'} or abort 'Missing app target'
test_name='LIFTdPreviewUITests'
abort 'Duplicate UI-test target' if project.targets.any?{|t| t.name==test_name}
target=project.new_target(:ui_test_bundle,test_name,:ios,app.build_configurations.first.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] || '15.1')
target.add_dependency(app)
file=project.main_group.new_file(File.expand_path('test/LIFTdPreviewUITests.swift'))
target.source_build_phase.add_file_reference(file)
target.build_configurations.each do |config|
  config.build_settings['SWIFT_VERSION']='5.0'
  config.build_settings['GENERATE_INFOPLIST_FILE']='YES'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER']='org.integrated420.liftd.preview.uitests'
  config.build_settings['TEST_TARGET_NAME']=app.name
  config.build_settings['CODE_SIGNING_ALLOWED']='NO'
end
project.save
scheme=Dir.glob('ios/*.xcodeproj/xcshareddata/xcschemes/*.xcscheme').find{|x| File.basename(x,'.xcscheme')==app.name}
abort 'Missing shared app scheme' unless scheme
xml=REXML::Document.new(File.read(scheme))
testables=REXML::XPath.first(xml,'//TestAction/Testables') or abort 'Missing Testables in scheme'
ref=testables.add_element('TestableReference',{'skipped'=>'NO'})
ref.add_element('BuildableReference',{
 'BuildableIdentifier'=>'primary',
 'BlueprintIdentifier'=>target.uuid,
 'BuildableName'=>test_name+'.xctest',
 'BlueprintName'=>test_name,
 'ReferencedContainer'=>'container:'+File.basename(project_path)
})
File.open(scheme,'w'){|out| xml.write(out,2)}
puts 'Configured native iOS XCTest UI journey'
