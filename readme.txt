=== Media Linked Library ===
Contributors: ole1986
Tags: media, library, linked media, links, content editor, shortcode, tinymce
Donate link: https://www.paypal.me/OleKoeckemann/5
Requires at least: 4.0.0
Tested up to: 4.6
Stable tag: trunk
License: GPLv3

Support for adding media files to post content using IDs instead of URLs (through TinyMCE Editor)

== Description ==
This plugin is used to improve the media library by adding media or attachment IDs instead of static URLs into the content editor (TinyMCE)

Features:

- fully compatible with the native WP Media Library

- search and filter for images using search text or categories

- file browser to upload and select file(s) from specific folders

- integration into TinyMCE using plugin extension

- upload multiple files (of any type)

- automatically generate thumbnails from PDF documents (ImageMagick required)

- shortcode [mediaref id=123 width=100 height=100]

Categories can by achieved by using the plugin "Enhanced Media Library" for instance (https://wordpress.org/plugins/enhanced-media-library/)

== Installation ==
Add it through wordpress or unpack the downloaded zip file into your wp-content/plugins directory

== Screenshots ==

1. Toolbar button in content editor to open media linked library dialog
2. Searching and selecting images in Media linked library
3. Add links to images using "Link with Image" button
4. Upload Browser

== Changelog ==

= v1.0.11 =
- ignore lightbox when opening in new window (useful for linked PDFs)

= v1.0.10 =
- possible hotfix when cached JS file is being loaded

= v1.0.9 =
- fixed wrong media file output when selecting folders from browser
- improve JS to better fetch shortcode params
- support for default alignments using the classes "alignleft, aligncenter, alignright"

= v1.0.8 =
- lightbox support by adding rel attribute in A tag (Lightbox plugin is possible required)

= v1.0.7 =
- fixed an issue when only width or height is defined in image size

= v1.0.6 =
- fixed issue with white spaces in URLs using encodeURI
- added support to generate thumbnails from PDFs (Image Magick is required)

= v1.0.5 =
- show media files in browser tab

= v1.0.4 =
- added a file browser (with create folder support)
- some design changes and code optimization

= v1.0.3 =
- support for multiple file uploads
- display upload button instead of the upload input type
- slightly improve taxonomy (esspacially when its empty)
- improved the getMedia method to work with both (search and upload)

= v1.0.2 =
- select destination subfolders (below uploadDir) while uploading files
- close dialog when ESC key is pressed

= v1.0.1 =
- inital wordpress version and author change

= v1.0.0 =
- inital version